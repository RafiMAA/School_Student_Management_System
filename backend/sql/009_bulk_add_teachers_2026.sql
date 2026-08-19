-- Bulk teacher import for Supabase SQL Editor.
-- All accounts use the temporary password: Meera7139$
--
-- IMPORTANT:
-- * This script aborts without making changes if any supplied email already exists.
-- * It creates the Supabase Auth user, teacher profile, and admin_users link.
-- * A class is assigned only when it occurs once in this import and is currently
--   unassigned. Duplicate or already-assigned classes are reported and skipped.

DO $import$
DECLARE
    teacher_data CONSTANT jsonb := $data$
    [
      {"full_name":"Fathima Risma Nisar",             "class_name":"Grade 2 Sinhala Mixed", "email":"rismanisar05@gmail.com",          "contact":"0775018873"},
      {"full_name":"Aysha Amaani Azmi",              "class_name":null,                    "email":"ahamedayaan282@gamil.com",       "contact":"0722369144"},
      {"full_name":"Hashma Humam",                   "class_name":"Grade 7 Sinhala Girls", "email":"hashmaofficial19@gmail.com",      "contact":"0764381026"},
      {"full_name":"Fathima Firza",                  "class_name":"Grade 5 Tamil Mixed",   "email":"mohamedwazeer199@gmail.com",      "contact":"0742747052"},
      {"full_name":"Hasna Humam",                    "class_name":"Grade 9 Sinhala Girls", "email":"mhf.hasna.f8@gmail.com",           "contact":"0760462525"},
      {"full_name":"M.R Ummu Kulsum",                "class_name":"Grade 3 Tamil Mixed",   "email":"riyasmax100@gmail.com",            "contact":"0779459198"},
      {"full_name":"Fathima Bidara",                 "class_name":"Grade 8 Sinhala Girls", "email":"bidaraijaz@gmail.com",              "contact":"0761989068"},
      {"full_name":"Z.H Fathima Zafra",              "class_name":"Grade 2 Sinhala Mixed", "email":"fathimazafra94@gmail.com",          "contact":"0760936922"},
      {"full_name":"F. Shaffana Hismath",            "class_name":"Grade 5 Sinhala Girls", "email":"shaffana2004@gmail.com",            "contact":"0704666568"},
      {"full_name":"MN Abdul Malik",                 "class_name":"Grade 4 Tamil Mixed",   "email":"sajidahamedmatara123@gmail.com",    "contact":"0764727109"},
      {"full_name":"M.W.Salman Faris",               "class_name":"Grade 5 Sinhala Boys",  "email":"salman06sallu@gmail.com",           "contact":"0706151565"},
      {"full_name":"M.N.Najath Ahamad",              "class_name":"Grade 7 Tamil Mixed",   "email":"ahamednajath67@gmail.com",          "contact":"0775221249"},
      {"full_name":"Maryam Ashker",                  "class_name":"Grade 3 Sinhala Mixed", "email":"maryamashker9@gmail.com",            "contact":"0722170097"},
      {"full_name":"Noor Shahama",                   "class_name":null,                    "email":"noorshahama@gmail.com",             "contact":"0714754888"},
      {"full_name":"Fathima Rukaiya",                "class_name":"Grade 2 Tamil Mixed",   "email":"binthnakeeb18@gmail.com",           "contact":"0711908130"},
      {"full_name":"Mohamed Hasmy Muhammed Hassaan", "class_name":"Grade 8 Sinhala Boys",  "email":"mhhmuh2024@gmail.com",              "contact":"0742772024"},
      {"full_name":"Fathima Afra Rifky",             "class_name":null,                    "email":"Mishwes2017@gmail.com",             "contact":"0705568594"},
      {"full_name":"Aayisha Shaima",                 "class_name":null,                    "email":"aayishashaima494@gmail.com",        "contact":"0770387464"},
      {"full_name":"M. Mifraz Naisar",               "class_name":"Grade 6 Sinhala Boys",  "email":"naisarmarzoona1974@gmail.com",      "contact":"0775042653"},
      {"full_name":"M.W.M Farshad",                  "class_name":"Grade 5 Sinhala Boys",  "email":"farshadking071@gmail.com",          "contact":"0714604723"},
      {"full_name":"Fathima Bishra Ijaz",            "class_name":"Grade 4 Sinhala Girls", "email":"bishra.ijaz@gmail.com",              "contact":"0757900632"},
      {"full_name":"Hafsa Rahuman",                  "class_name":"Grade 4 Sinhala Boys",  "email":"hafsarahuman123@gmail.com",         "contact":"0770360147"}
    ]
    $data$::jsonb;

    item              record;
    auth_user_id      uuid;
    teacher_profile_id uuid;
    target_class_id   uuid;
    same_class_count  integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.academic_years WHERE is_current = TRUE) THEN
        RAISE EXCEPTION 'No current academic year exists';
    END IF;

    -- Fail atomically rather than creating duplicate or partially-linked users.
    IF EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(teacher_data)
             AS d(full_name text, class_name text, email text, contact text)
        WHERE EXISTS (
            SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(d.email)
        ) OR EXISTS (
            SELECT 1 FROM public.teachers t WHERE lower(t.username) = lower(d.email)
        )
    ) THEN
        RAISE EXCEPTION 'At least one supplied email already exists; no accounts were created';
    END IF;

    FOR item IN
        SELECT *
        FROM jsonb_to_recordset(teacher_data)
             AS d(full_name text, class_name text, email text, contact text)
    LOOP
        auth_user_id := gen_random_uuid();

        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000'::uuid,
            auth_user_id,
            'authenticated',
            'authenticated',
            lower(item.email),
            extensions.crypt('Meera7139$', extensions.gen_salt('bf')),
            now(),
            '',
            '',
            '',
            '',
            jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
            jsonb_build_object('full_name', item.full_name),
            now(),
            now()
        );

        INSERT INTO auth.identities (
            id,
            provider_id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            auth_user_id::text,
            auth_user_id,
            jsonb_build_object(
                'sub', auth_user_id::text,
                'email', lower(item.email),
                'email_verified', true,
                'phone_verified', false
            ),
            'email',
            now(),
            now(),
            now()
        );

        INSERT INTO public.teachers (
            full_name, contact, address, username, password_hash, role, status
        ) VALUES (
            item.full_name,
            item.contact,
            NULL,
            lower(item.email),
            'supabase-managed',
            'Teacher'::teacher_role,
            'Active'::teacher_status
        )
        RETURNING id INTO teacher_profile_id;

        INSERT INTO public.admin_users (
            id, full_name, role, teacher_id, is_active
        ) VALUES (
            auth_user_id, item.full_name, 'Teacher', teacher_profile_id, TRUE
        );

        IF item.class_name IS NOT NULL THEN
            SELECT count(*) INTO same_class_count
            FROM jsonb_to_recordset(teacher_data)
                 AS d(full_name text, class_name text, email text, contact text)
            WHERE d.class_name = item.class_name;

            IF same_class_count > 1 THEN
                RAISE NOTICE '% left unassigned: % occurs % times in this import',
                    item.full_name, item.class_name, same_class_count;
            ELSE
                SELECT c.id INTO target_class_id
                FROM public.classes c
                JOIN public.academic_years ay ON ay.id = c.academic_year_id
                WHERE ay.is_current = TRUE
                  AND c.is_active = TRUE
                  AND ('Grade ' || c.grade::text || ' ' || c.medium::text || ' ' || c.gender_type::text) = item.class_name
                  AND c.teacher_id IS NULL
                LIMIT 1;

                IF target_class_id IS NULL THEN
                    RAISE NOTICE '% left unassigned: class % is missing, inactive, or already assigned',
                        item.full_name, item.class_name;
                ELSE
                    UPDATE public.classes
                    SET teacher_id = teacher_profile_id
                    WHERE id = target_class_id;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RAISE NOTICE 'Created % teacher accounts', jsonb_array_length(teacher_data);
END
$import$;

-- Verification result shown after a successful run.
SELECT
    t.full_name,
    t.username AS email,
    t.contact,
    COALESCE(
        'Grade ' || c.grade::text || ' ' || c.medium::text || ' ' || c.gender_type::text,
        'Not assigned yet'
    ) AS assigned_class,
    au.is_active AS login_active
FROM public.teachers t
JOIN public.admin_users au ON au.teacher_id = t.id
LEFT JOIN public.classes c
       ON c.teacher_id = t.id
      AND c.academic_year_id = (SELECT id FROM public.academic_years WHERE is_current = TRUE)
WHERE lower(t.username) IN (
    'rismanisar05@gmail.com', 'ahamedayaan282@gamil.com',
    'hashmaofficial19@gmail.com', 'mohamedwazeer199@gmail.com',
    'mhf.hasna.f8@gmail.com', 'riyasmax100@gmail.com',
    'bidaraijaz@gmail.com', 'fathimazafra94@gmail.com',
    'shaffana2004@gmail.com', 'sajidahamedmatara123@gmail.com',
    'salman06sallu@gmail.com', 'ahamednajath67@gmail.com',
    'maryamashker9@gmail.com', 'noorshahama@gmail.com',
    'binthnakeeb18@gmail.com', 'mhhmuh2024@gmail.com',
    'mishwes2017@gmail.com', 'aayishashaima494@gmail.com',
    'naisarmarzoona1974@gmail.com', 'farshadking071@gmail.com',
    'bishra.ijaz@gmail.com', 'hafsarahuman123@gmail.com'
)
ORDER BY t.full_name;
