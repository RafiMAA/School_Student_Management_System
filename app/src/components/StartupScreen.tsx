export default function StartupScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 dark:bg-[#06101f] px-6">
      <div className="flex flex-col items-center text-center -translate-y-[3vh]">
        <img
          src="/ahadiya-logo-black.png"
          alt="Al-Meera Ahadiya School"
          className="w-[min(64vw,300px)] h-auto object-contain dark:hidden"
        />
        <img
          src="/ahadiya-logo-white.png"
          alt="Al-Meera Ahadiya School"
          className="hidden w-[min(64vw,300px)] h-auto object-contain dark:block"
        />
        <h1 className="mt-5 text-[clamp(1.65rem,6vw,2.6rem)] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
          Al-Meera Ahadiya School
        </h1>
        <p className="mt-3 text-[clamp(1rem,4vw,1.45rem)] font-bold text-emerald-600 dark:text-emerald-400">
          Ahadiya Management System
        </p>
      </div>
    </div>
  );
}
