import styles from "./claim-code-rain.module.css";

/** Decorative, deterministic code rain: no credentials or live data. */
export default function ClaimCodeRain() {
  const glyphs = "01abcdef{}[]<>/アイウエオカキクケコ";
  return (
    <div className={styles.rain} aria-hidden="true">
      {Array.from({ length: 24 }, (_, column) => (
        <span key={column} className={styles.column} style={{
          left: `${column * 4.3}%`,
          animationDuration: `${26 + column % 7 * 3}s`,
          animationDelay: `-${column * 3.7}s`,
        }}>
          {Array.from({ length: 42 }, (_, row) => glyphs[(column * 7 + row * 13) % glyphs.length]).join("\n")}
        </span>
      ))}
    </div>
  );
}
