// Seed teaching preview card
// Remove this file when stripping marketing pages from a fork

interface SeedData {
  id: number;
  title: string;
  summary: string;
  quote: string;
  tags: string[];
}

interface SeedPreviewProps {
  seed: SeedData;
}

export default function SeedPreview({ seed }: SeedPreviewProps) {
  return (
    <div className="pub-seed">
      <h3 className="pub-seed__title">{seed.title}</h3>
      <p className="pub-seed__summary">{seed.summary}</p>
      {seed.quote && (
        <blockquote className="pub-seed__quote">{seed.quote}</blockquote>
      )}
      {seed.tags.length > 0 && (
        <div className="pub-seed__tags">
          {seed.tags.slice(0, 5).map(tag => (
            <span key={tag} className="pub-seed__tag">{tag.replace(/-/g, ' ')}</span>
          ))}
        </div>
      )}
    </div>
  );
}
