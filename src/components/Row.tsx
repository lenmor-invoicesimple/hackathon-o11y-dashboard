type RowProps = {
  label: string;
  value: string;
  valueClass?: string;
};

export const Row = ({ label, value, valueClass = 'text-gray-200' }: RowProps) => (
  <div className="flex gap-2">
    <span className="text-gray-600 w-20 shrink-0">{label}</span>
    <span className={valueClass}>{value}</span>
  </div>
);
