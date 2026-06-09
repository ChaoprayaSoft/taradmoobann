export default function Logo({ className = "w-7 h-7 text-brand-600" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Ground (Between Mug and Bread) */}
      <path d="M5 22h7" />
      {/* Shop Outline (Left wall stops at mug, Right wall stops at bread) */}
      <path d="M4 17V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10.5" />
      {/* Simple Awning */}
      <path d="M3 11h18" />
      {/* 3 Large Scallops */}
      <path d="M3 11a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      {/* Smaller Display Window on the left */}
      <rect x="6" y="14" width="5" height="5" rx="1" />
      {/* Big Bread Loaf overlapping bottom right */}
      <path d="M12 22c0-4.5 2.5-6 5.5-6s5.5 1.5 5.5 6z" />
      {/* Bread Scores */}
      <path d="M15 18.5l1.5 1.5M18 18.5l1.5 1.5" />
      {/* Coffee Mug overlapping bottom left */}
      <path d="M1 17v4a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-4z" />
      {/* Mug Handle */}
      <path d="M1 18.5H0v1.5h1" />
      {/* Coffee Steam */}
      <path d="M3 15c-1-1 1-2 0-3" />
    </svg>
  );
}
