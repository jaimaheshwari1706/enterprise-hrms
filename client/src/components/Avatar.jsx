export default function Avatar({ src, name, size = 36 }) {
  const initials = name
    ? name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="flex items-center justify-center rounded-full bg-indigo-100 font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
    >
      {initials}
    </div>
  );
}
