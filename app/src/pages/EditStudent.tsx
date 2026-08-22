import { useState, useEffect } from "react";
import { ArrowLeft, Save, FileText, ClipboardList } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/contexts/ToastContext";
import api from "@/lib/apiClient";
import type { Class, Student } from "@/types";
import StudentAchievements from "@/components/StudentAchievements";

export default function EditStudent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    fullName: "",
    gender: "" as "Male" | "Female" | "",
    dob: "",
    parentName: "",
    parentName2: "",
    parentContact: "",
    parentContact2: "",
    medium: "" as "Sinhala" | "Tamil" | "",
    grade: "",
    classId: "",
    joinedDate: "",
    graduationYear: "",
    status: "Active" as Student["status"],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'achievements'>('profile');

  useEffect(() => {
    Promise.all([
      api.get<Class[]>("/classes"),
      api.get<Student>(`/students/${id}`),
    ])
      .then(([classesData, studentData]) => {
        setClasses(classesData);
        setForm({
          fullName: studentData.full_name,
          gender: studentData.gender as any,
          dob: studentData.date_of_birth,
          parentName: studentData.parent_name || "",
          parentName2: studentData.parent_name_2 || "",
          parentContact: studentData.parent_contact || "",
          parentContact2: studentData.parent_contact_2 || "",
          medium: studentData.medium as any,
          grade: studentData.current_grade.toString(),
          classId: studentData.current_class_id || "",
          joinedDate:
            studentData.joined_date || new Date().toISOString().split("T")[0],
          graduationYear: studentData.graduation_year || "",
          status: studentData.status,
        });
        setLoading(false);
      })
      .catch(() => {
        addToast("error", "Failed to load student details");
        navigate("/students");
      });
  }, [id, navigate, addToast]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "classId" && value) {
        const cls = classes.find((c) => c.id === value);
        if (cls) {
          next.grade = cls.grade;
          next.medium = cls.medium;
        }
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.fullName) errs.fullName = "Required";
    if (!form.gender) errs.gender = "Required";
    if (!form.dob) errs.dob = "Required";
    if (!form.parentName) errs.parentName = "Required";
    if (!form.parentContact || !/^[0-9]{10}$/.test(form.parentContact))
      errs.parentContact = "Must be 10 digits";
    if (form.parentContact2 && !/^[0-9]{10}$/.test(form.parentContact2))
      errs.parentContact2 = "Must be 10 digits";
    if (!form.medium) errs.medium = "Required";
    if (form.status === "Alumni") {
      if (!/^\d{4}$/.test(form.graduationYear)) {
        errs.graduationYear = "Enter a four-digit year";
      }
    } else {
      if (!form.grade) errs.grade = "Required";
      if (!form.classId) errs.classId = "Required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        full_name: form.fullName,
        gender: form.gender,
        date_of_birth: form.dob,
        parent_name: form.parentName,
        parent_name_2: form.parentName2 || null,
        parent_contact: form.parentContact,
        parent_contact_2: form.parentContact2 || null,
        medium: form.medium,
        joined_date: form.joinedDate,
        ...(form.status === "Alumni"
          ? { graduation_year: form.graduationYear }
          : {
              current_grade: parseInt(form.grade),
              current_class_id: form.classId,
            }),
      };
      await api.patch(`/students/${id}`, payload);
      addToast("success", "Student updated successfully");
      navigate(form.status === "Alumni" ? `/students/alumni/${id}` : `/students/${id}`);
    } catch (err: any) {
      addToast("error", err?.data?.detail || "Failed to update student");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field: string, isPlaceholder: boolean = false) =>
    `w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 outline-none ${
      isPlaceholder ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"
    } ${
      errors[field]
        ? "border-red-300 focus:border-red-500"
        : "border-slate-200 dark:border-slate-700"
    }`;



  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/students")}
          className="pwa-desktop-only p-2 rounded-lg hover:bg-slate-100 dark:bg-slate-800 text-slate-500 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Edit Student Details
        </h2>
      </div>

      <div
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
      >
        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <ClipboardList className="w-4 h-4" /> Profile Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('achievements')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'achievements'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" /> Student Report
          </button>
        </div>

        {activeTab === 'profile' ? (
        <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => handleChange("fullName", e.target.value)}
              className={inputClass("fullName")}
              placeholder="Enter full name"
            />
            {errors.fullName && (
              <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Gender <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 opacity-60 cursor-not-allowed">
              <button
                type="button"
                disabled
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${form.gender === "Male" ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"}`}
              >
                Male
              </button>
              <button
                type="button"
                disabled
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${form.gender === "Female" ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"}`}
              >
                Female
              </button>
            </div>
            {errors.gender && (
              <p className="mt-1 text-xs text-red-500">{errors.gender}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Date of Birth <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.dob}
              onChange={(e) => handleChange("dob", e.target.value)}
              className={inputClass("dob")}
            />
            {errors.dob && (
              <p className="mt-1 text-xs text-red-500">{errors.dob}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Parent/Guardian Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.parentName}
              onChange={(e) => handleChange("parentName", e.target.value)}
              className={inputClass("parentName")}
              placeholder="Enter parent's name"
            />
            {errors.parentName && (
              <p className="mt-1 text-xs text-red-500">{errors.parentName}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Parent Contact Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={form.parentContact}
              onChange={(e) => handleChange("parentContact", e.target.value)}
              className={inputClass("parentContact")}
              placeholder="e.g. 0771234567"
            />
            {errors.parentContact && (
              <p className="mt-1 text-xs text-red-500">
                {errors.parentContact}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Secondary Contact Name <span className="text-xs text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={form.parentName2}
              onChange={(e) => handleChange("parentName2", e.target.value)}
              className={inputClass("parentName2")}
              placeholder="Enter parent's name"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Secondary Contact <span className="text-xs text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="tel"
              value={form.parentContact2}
              onChange={(e) => handleChange("parentContact2", e.target.value)}
              className={inputClass("parentContact2")}
              placeholder="e.g. 0771234567"
            />
            {errors.parentContact2 && (
              <p className="mt-1 text-xs text-red-500">
                {errors.parentContact2}
              </p>
            )}
          </div>

          <div className="md:col-span-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Academic Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Medium <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.medium}
                  disabled
                  className={`${inputClass("medium", !form.medium)} opacity-60 cursor-not-allowed`}
                >
                  <option value="" disabled className="text-slate-500">Select medium</option>
                  <option value="Sinhala" className="text-slate-900 dark:text-white">Sinhala</option>
                  <option value="Tamil" className="text-slate-900 dark:text-white">Tamil</option>
                </select>
                {errors.medium && (
                  <p className="mt-1 text-xs text-red-500">{errors.medium}</p>
                )}
              </div>

              {form.status === "Alumni" ? (
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Graduated Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={form.graduationYear}
                  onChange={(e) => handleChange("graduationYear", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className={inputClass("graduationYear")}
                  placeholder="e.g. 2023"
                />
                {errors.graduationYear && (
                  <p className="mt-1 text-xs text-red-500">{errors.graduationYear}</p>
                )}
              </div>
              ) : (<>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Grade <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.grade}
                  disabled
                  className={`${inputClass("grade", !form.grade)} opacity-60 cursor-not-allowed`}
                >
                  <option value="" disabled className="text-slate-500">Select grade</option>
                  {Array.from({ length: 11 }, (_, i) => (i + 1).toString()).map(
                    (g) => (
                      <option key={g} value={g} className="text-slate-900 dark:text-white">
                        Grade {g}
                      </option>
                    ),
                  )}
                </select>
                {errors.grade && (
                  <p className="mt-1 text-xs text-red-500">{errors.grade}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Assign to Class <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.classId}
                  disabled
                  className={`${inputClass("classId", !form.classId)} opacity-60 cursor-not-allowed`}
                >
                  <option value="" disabled className="text-slate-500">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id} className="text-slate-900 dark:text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.classId && (
                  <p className="mt-1 text-xs text-red-500">{errors.classId}</p>
                )}
              </div>
              </>)}

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Joined Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.joinedDate}
                  onChange={(e) => handleChange("joinedDate", e.target.value)}
                  className={inputClass("joinedDate")}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-slate-100 dark:border-slate-800">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors active:scale-95"
          >
            <Save className="w-4 h-4" />{" "}
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
        </div>
        </form>
        ) : (
          <div className="p-6">
            <StudentAchievements studentId={id!} />
          </div>
        )}
      </div>
    </div>
  );
}
