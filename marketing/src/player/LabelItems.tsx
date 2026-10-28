// The label's items with their dots for the eye only (as components/player/LabelItems.astro): a screen reader hears
// the items apart by a hidden comma, never "middle dot".
export function LabelItems({ brief }: { brief: string }) {
  const items = brief.split(' · ');
  return (
    <>
      {items.map((item, i) => (
        <span key={i}>{i > 0 ? ' ' : ''}<span className="sp-label__half">{item}{i < items.length - 1 && <><span aria-hidden="true">{'\u00a0·'}</span><span className="sp-sr">,</span></>}</span></span>
      ))}
    </>
  );
}
