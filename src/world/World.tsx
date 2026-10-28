export default function World({ onExit }: { onExit: () => void }) {
  return (
    <div className="fixed inset-0 grid place-items-center bg-black text-white">
      <button onClick={onExit}>←</button>
    </div>
  );
}
