from fastapi import APIRouter, Depends, HTTPException
import asyncpg

from app.database import get_db
from app.auth import get_current_user, require_super_admin
from app.models import PromotionRuleCreate, PromotionRuleUpdate, PromotionRuleResponse, PromotionPreviewRow, PromotionExecute, PromotionResult
from app.cache import cache_invalidate, CURRENT_YEAR

router = APIRouter()


async def _get_class_name(db, class_id):
    if not class_id:
        return None
    r = await db.fetchrow("SELECT grade, medium, gender_type FROM classes WHERE id = $1", class_id)
    return f"Grade {r['grade']} {r['medium']} {r['gender_type']}" if r else None


# ---- PROMOTION RULES ----

@router.get("/rules", response_model=list[PromotionRuleResponse])
async def list_promotion_rules(
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    rows = await db.fetch(
        """SELECT pr.*,
                  f.grade AS f_grade, f.medium AS f_medium, f.gender_type AS f_gt,
                  m.grade AS m_grade, m.medium AS m_medium, m.gender_type AS m_gt,
                  fe.grade AS fe_grade, fe.medium AS fe_medium, fe.gender_type AS fe_gt
           FROM promotion_rules pr
           JOIN classes f ON pr.from_class_id = f.id
           LEFT JOIN classes m ON pr.male_to_class_id = m.id
           LEFT JOIN classes fe ON pr.female_to_class_id = fe.id
           WHERE pr.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE)
           ORDER BY f.medium, f.grade, f.gender_type"""
    )
    return [
        PromotionRuleResponse(
            id=str(r["id"]),
            from_class_id=str(r["from_class_id"]),
            from_class_name=f"Grade {r['f_grade']} {r['f_medium']} {r['f_gt']}",
            male_to_class_id=str(r["male_to_class_id"]) if r["male_to_class_id"] else None,
            male_to_class_name=f"Grade {r['m_grade']} {r['m_medium']} {r['m_gt']}" if r.get("m_grade") else None,
            female_to_class_id=str(r["female_to_class_id"]) if r["female_to_class_id"] else None,
            female_to_class_name=f"Grade {r['fe_grade']} {r['fe_medium']} {r['fe_gt']}" if r.get("fe_grade") else None,
            academic_year_id=str(r["academic_year_id"]),
        )
        for r in rows
    ]


@router.post("/rules", status_code=201)
async def create_promotion_rule(
    body: PromotionRuleCreate,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    year = await db.fetchval("SELECT id FROM academic_years WHERE is_current = TRUE")
    if not year:
        raise HTTPException(status_code=400, detail="No current academic year")
    await db.execute(
        """INSERT INTO promotion_rules (from_class_id, male_to_class_id, female_to_class_id, academic_year_id)
           VALUES ($1, $2, $3, $4)""",
        body.from_class_id, body.male_to_class_id, body.female_to_class_id, year,
    )
    return {"message": "Rule created"}


@router.patch("/rules/{rule_id}")
async def update_promotion_rule(
    rule_id: str, body: PromotionRuleUpdate,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    updates, params, idx = [], [], 1
    if body.male_to_class_id is not None:
        updates.append(f"male_to_class_id = ${idx}")
        params.append(body.male_to_class_id); idx += 1
    if body.female_to_class_id is not None:
        updates.append(f"female_to_class_id = ${idx}")
        params.append(body.female_to_class_id); idx += 1
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    params.append(rule_id)
    await db.execute(f"UPDATE promotion_rules SET {', '.join(updates)} WHERE id = ${idx}", *params)
    return {"message": "Rule updated"}


@router.delete("/rules/{rule_id}")
async def delete_promotion_rule(
    rule_id: str,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    await db.execute("DELETE FROM promotion_rules WHERE id = $1", rule_id)
    return {"message": "Rule deleted"}


# ---- PROMOTION PREVIEW & EXECUTE ----

@router.get("/preview", response_model=list[PromotionPreviewRow])
async def promotion_preview(
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    year_id = await db.fetchval("SELECT id FROM academic_years WHERE is_current = TRUE")
    if not year_id:
        raise HTTPException(status_code=400, detail="No current academic year")

    # Fetch ALL active students regardless of which academic year their class belongs to.
    # Students may have been assigned to classes from an older academic year.
    students = await db.fetch(
        """SELECT s.id, s.full_name, s.gender, s.current_class_id, s.current_grade,
                  c.grade, c.medium, c.gender_type, c.academic_year_id
           FROM students s
           JOIN classes c ON s.current_class_id = c.id
           WHERE s.status = 'Active'
           ORDER BY c.medium, c.grade, s.full_name""",
    )

    rules = await db.fetch(
        "SELECT * FROM promotion_rules WHERE academic_year_id = $1", year_id
    )
    rule_map = {str(r["from_class_id"]): r for r in rules}

    # Build a signature-based rule map so students from old-year classes can also match
    # Key: "grade-medium-gender_type" of the from_class
    from_class_ids = [r["from_class_id"] for r in rules]
    from_classes = await db.fetch(
        "SELECT id, grade, medium, gender_type FROM classes WHERE id = ANY($1)",
        from_class_ids,
    ) if from_class_ids else []
    from_class_sig = {str(fc["id"]): f"{fc['grade']}-{fc['medium']}-{fc['gender_type']}" for fc in from_classes}
    rule_by_sig: dict[str, dict] = {}
    for r in rules:
        sig = from_class_sig.get(str(r["from_class_id"]))
        if sig:
            rule_by_sig[sig] = r

    # Batch-load all target class names in one query instead of N+1
    target_class_ids = set()
    for r in rules:
        if r["male_to_class_id"]:
            target_class_ids.add(r["male_to_class_id"])
        if r["female_to_class_id"]:
            target_class_ids.add(r["female_to_class_id"])

    class_name_map: dict[str, str] = {}
    if target_class_ids:
        target_rows = await db.fetch(
            "SELECT id, grade, medium, gender_type FROM classes WHERE id = ANY($1)",
            list(target_class_ids),
        )
        for tr in target_rows:
            class_name_map[str(tr["id"])] = f"Grade {tr['grade']} {tr['medium']} {tr['gender_type']}"

    preview = []
    for s in students:
        class_id = str(s["current_class_id"])
        current_class = f"Grade {s['grade']} {s['medium']} {s['gender_type']}"

        if s["grade"] == 11:
            preview.append(PromotionPreviewRow(
                student_id=str(s["id"]), student_name=s["full_name"],
                gender=s["gender"], current_class=current_class,
                target_class="Alumni", action="GRADUATE",
            ))
        else:
            # Try direct class_id match first, then fall back to signature match
            rule = rule_map.get(class_id)
            if not rule:
                sig = f"{s['grade']}-{s['medium']}-{s['gender_type']}"
                rule = rule_by_sig.get(sig)

            if rule:
                target_id = rule["male_to_class_id"] if s["gender"] == "Male" else rule["female_to_class_id"]
                target_name = class_name_map.get(str(target_id)) if target_id else None
                if target_name:
                    preview.append(PromotionPreviewRow(
                        student_id=str(s["id"]), student_name=s["full_name"],
                        gender=s["gender"], current_class=current_class,
                        target_class=target_name, action="PROMOTE",
                    ))

    return preview


@router.post("/execute", response_model=PromotionResult)
async def execute_promotion(
    body: PromotionExecute,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    year_id = body.academic_year_id
    rules = await db.fetch("SELECT * FROM promotion_rules WHERE academic_year_id = $1", year_id)
    if not rules:
        raise HTTPException(status_code=400, detail="No promotion rules defined for this year")
    rule_map = {str(r["from_class_id"]): r for r in rules}

    students = await db.fetch(
        """SELECT s.id, s.full_name, s.gender, s.current_class_id, s.current_grade,
                  c.grade AS c_grade, c.medium AS c_medium, c.gender_type AS c_gt
           FROM students s
           JOIN classes c ON s.current_class_id = c.id
           WHERE s.status = 'Active'""",
    )

    # Build a signature-based rule map for students from old-year classes
    from_class_ids = [r["from_class_id"] for r in rules]
    from_classes_rows = await db.fetch(
        "SELECT id, grade, medium, gender_type FROM classes WHERE id = ANY($1)",
        from_class_ids,
    ) if from_class_ids else []
    from_class_sig = {str(fc["id"]): f"{fc['grade']}-{fc['medium']}-{fc['gender_type']}" for fc in from_classes_rows}
    rule_by_sig: dict[str, dict] = {}
    for r in rules:
        sig = from_class_sig.get(str(r["from_class_id"]))
        if sig:
            rule_by_sig[sig] = r

    promoted, graduated = 0, 0
    errors = []
    
    # 1. Determine Next Academic Year
    year_row = await db.fetchrow("SELECT year_label, start_date FROM academic_years WHERE id = $1", year_id)
    old_year_label = year_row["year_label"]
    try:
        next_year_num = int(old_year_label) + 1
        next_year_label = str(next_year_num)
    except ValueError:
        next_year_label = old_year_label + " (Next)"
        
    next_year = await db.fetchrow("SELECT id FROM academic_years WHERE year_label = $1", next_year_label)
    
    async with db.acquire() as conn:
        async with conn.transaction():
            if next_year:
                new_year_id = next_year["id"]
            else:
                from datetime import date, datetime
                # Parse start_date from body or use today
                if body.start_date:
                    new_start_date = datetime.strptime(body.start_date, "%Y-%m-%d").date()
                else:
                    new_start_date = date.today()
                    
                row = await conn.fetchrow(
                    "INSERT INTO academic_years (year_label, start_date, is_current) VALUES ($1, $2, FALSE) RETURNING id",
                    next_year_label, new_start_date
                )
                new_year_id = row["id"]

                # Clone ALL Classes from old year to new year
                old_classes = await conn.fetch("SELECT * FROM classes WHERE academic_year_id = $1", year_id)
                for oc in old_classes:
                    await conn.execute(
                        """INSERT INTO classes (grade, medium, gender_type, academic_year_id, teacher_id)
                           VALUES ($1, $2, $3, $4, $5)""",
                        oc["grade"], oc["medium"], oc["gender_type"], new_year_id, oc.get("teacher_id")
                    )

            # Build a robust mapping of old_class_id -> new_class_id based on signature
            old_classes_mapped = await conn.fetch("SELECT id, grade, medium, gender_type FROM classes WHERE academic_year_id = $1", year_id)
            new_classes_mapped = await conn.fetch("SELECT id, grade, medium, gender_type FROM classes WHERE academic_year_id = $1", new_year_id)
            
            new_class_by_sig = {
                f"{nc['grade']}-{nc['medium']}-{nc['gender_type']}": str(nc["id"])
                for nc in new_classes_mapped
            }
            
            class_map = {}
            for oc in old_classes_mapped:
                sig = f"{oc['grade']}-{oc['medium']}-{oc['gender_type']}"
                if sig in new_class_by_sig:
                    class_map[str(oc["id"])] = new_class_by_sig[sig]

            # If we just created the new year, clone the rules using the map
            if not next_year:
                for r in rules:
                    new_from = class_map.get(str(r["from_class_id"]))
                    new_male = class_map.get(str(r["male_to_class_id"])) if r["male_to_class_id"] else None
                    new_female = class_map.get(str(r["female_to_class_id"])) if r["female_to_class_id"] else None
                    if new_from:
                        await conn.execute(
                            """INSERT INTO promotion_rules (from_class_id, male_to_class_id, female_to_class_id, academic_year_id)
                               VALUES ($1, $2, $3, $4)""",
                            new_from, new_male, new_female, new_year_id
                        )

            for s in students:
                class_id = str(s["current_class_id"])
                try:
                    if s["current_grade"] == 11:
                        await conn.execute(
                            "UPDATE students SET status = 'Alumni', graduation_year = $1 WHERE id = $2",
                            old_year_label, s["id"],
                        )
                        await conn.execute(
                            """INSERT INTO promotion_history (student_id, from_class_id, to_class_id, academic_year_id, promoted_by)
                               VALUES ($1, $2, $2, $3, $4)""",
                            s["id"], s["current_class_id"], year_id, user.get("teacher_id"),
                        )
                        graduated += 1
                    else:
                        old_target_id = None
                        is_promoted = False
                        
                        # Try direct class_id match first, then signature match
                        rule = rule_map.get(class_id)
                        if not rule:
                            sig = f"{s['c_grade']}-{s['c_medium']}-{s['c_gt']}"
                            rule = rule_by_sig.get(sig)

                        if rule:
                            target_uuid = rule["male_to_class_id"] if s["gender"] == "Male" else rule["female_to_class_id"]
                            if target_uuid:
                                old_target_id = str(target_uuid)
                                is_promoted = True

                        # Find the equivalent class in the new year
                        if is_promoted and old_target_id in class_map:
                            final_target_id = class_map[old_target_id]
                        elif is_promoted and old_target_id:
                            # Target class might not be in class_map (old year), try signature
                            tc = await conn.fetchrow("SELECT grade, medium, gender_type FROM classes WHERE id = $1", old_target_id)
                            if tc:
                                tsig = f"{tc['grade']}-{tc['medium']}-{tc['gender_type']}"
                                final_target_id = new_class_by_sig.get(tsig)
                                if not final_target_id:
                                    continue
                            else:
                                continue
                        else:
                            # If not promoted, they just roll over to the exact same class but in the new academic year
                            if class_id in class_map:
                                final_target_id = class_map[class_id]
                                is_promoted = False
                            else:
                                # Student class from old year — find equivalent by signature
                                ssig = f"{s['c_grade']}-{s['c_medium']}-{s['c_gt']}"
                                final_target_id = new_class_by_sig.get(ssig)
                                if not final_target_id:
                                    continue
                                is_promoted = False

                        # Update student to the new class in the new academic year
                        target_class = await conn.fetchrow("SELECT grade FROM classes WHERE id = $1", final_target_id)
                        await conn.execute(
                            "UPDATE students SET current_class_id = $1, current_grade = $2 WHERE id = $3",
                            final_target_id, target_class["grade"], s["id"],
                        )
                        
                        if is_promoted:
                            await conn.execute(
                                """INSERT INTO promotion_history (student_id, from_class_id, to_class_id, academic_year_id, promoted_by)
                                   VALUES ($1, $2, $3, $4, $5)""",
                                s["id"], s["current_class_id"], final_target_id, year_id, user.get("teacher_id"),
                            )
                            promoted += 1
                except Exception as e:
                    errors.append(f"Error promoting {s['full_name']}: {str(e)}")

            # Rollover the academic year
            from datetime import date
            await conn.execute("UPDATE academic_years SET is_current = FALSE, end_date = $1 WHERE is_current = TRUE", date.today())
            await conn.execute("UPDATE academic_years SET is_current = TRUE WHERE id = $1", new_year_id)
            cache_invalidate(CURRENT_YEAR)

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "PROMOTION_EXECUTED",
        {"academic_year_id": str(new_year_id), "promoted": promoted, "graduated": graduated},
        user.get("teacher_id"),
    )

    return PromotionResult(promoted=promoted, graduated=graduated, errors=errors)

@router.post("/execute/undo")
async def undo_promotion(
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    current_year_id = await db.fetchval("SELECT id FROM academic_years WHERE is_current = TRUE")
    if not current_year_id:
        raise HTTPException(status_code=400, detail="No current academic year found")

    old_year_row = await db.fetchrow(
        "SELECT academic_year_id, MAX(promoted_at) as last_promo FROM promotion_history GROUP BY academic_year_id ORDER BY MAX(promoted_at) DESC LIMIT 1"
    )
    
    if not old_year_row:
        raise HTTPException(status_code=400, detail="No promotion history found to undo")
        
    old_year_id = old_year_row["academic_year_id"]
    
    if str(old_year_id) == str(current_year_id):
        raise HTTPException(status_code=400, detail="Cannot undo: Old year and current year are the same")
        
    async with db.acquire() as conn:
        async with conn.transaction():
            promoted_students = await conn.fetch(
                "SELECT student_id, from_class_id, to_class_id FROM promotion_history WHERE academic_year_id = $1",
                old_year_id
            )
            
            reverted = 0
            for ps in promoted_students:
                student_id = ps["student_id"]
                from_class_id = ps["from_class_id"]
                to_class_id = ps["to_class_id"]
                
                old_class = await conn.fetchrow("SELECT grade FROM classes WHERE id = $1", from_class_id)
                if not old_class:
                    continue
                
                old_grade = old_class["grade"]
                
                if old_grade == 11 and from_class_id == to_class_id:
                    await conn.execute(
                        "UPDATE students SET status = 'Active', graduation_year = NULL, current_class_id = $1, current_grade = $2 WHERE id = $3",
                        from_class_id, old_grade, student_id
                    )
                else:
                    await conn.execute(
                        "UPDATE students SET current_class_id = $1, current_grade = $2 WHERE id = $3",
                        from_class_id, old_grade, student_id
                    )
                reverted += 1
                
            await conn.execute("DELETE FROM promotion_history WHERE academic_year_id = $1", old_year_id)
            
            await conn.execute("DELETE FROM academic_years WHERE id = $1", current_year_id)
            
            await conn.execute("UPDATE academic_years SET is_current = TRUE, end_date = NULL WHERE id = $1", old_year_id)
            
            cache_invalidate(CURRENT_YEAR)
            
    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "PROMOTION_UNDO",
        {"reverted": reverted, "deleted_year_id": str(current_year_id), "restored_year_id": str(old_year_id)},
        user.get("teacher_id"),
    )

    return {"message": f"Successfully undid promotion. Reverted {reverted} students."}

