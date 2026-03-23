/** 노드 내부의 파라미터 한 줄 표시 */
export default function ParamRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-text-muted text-[8px] tracking-wider uppercase">
        {label}
      </span>
      <span className="text-text-secondary text-[10px] font-medium tabular-nums">
        {value}
      </span>
    </div>
  );
}
