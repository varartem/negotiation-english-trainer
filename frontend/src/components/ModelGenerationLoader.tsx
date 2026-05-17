interface ModelGenerationLoaderProps {
  label: string;
}

export default function ModelGenerationLoader({ label }: ModelGenerationLoaderProps) {
  return (
    <div className="transcription-progress transcription-progress-indeterminate" aria-live="polite">
      <span>{label}</span>
      <div className="transcription-progress-track">
        <span />
      </div>
    </div>
  );
}
