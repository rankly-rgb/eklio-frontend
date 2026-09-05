"use client";

import { useAssetUrl } from "@/lib/kit/use-asset-url";
import { MonoLabel } from "@/components/ui/mono-label";
import { FRAME_LABEL, IN_SITU_FRAME, InSituFrame, type FrameType } from "@/components/kit/in-situ/frames";
import { track } from "@/lib/analytics";

/**
 * One frame, fetching its own image. Used both for the open asset's own
 * frame and for each entry in "Also see it in place".
 */
function FramedAsset({
  brandKitId,
  assetKey,
  type,
  practiceName,
}: {
  brandKitId: string;
  assetKey: string;
  type: FrameType;
  practiceName: string;
}) {
  const url = useAssetUrl(brandKitId, assetKey);
  if (!url) return <div className="aspect-[4/3] w-full animate-pulse rounded-card bg-card" />;
  return <InSituFrame type={type} imageUrl={url} practiceName={practiceName} />;
}

/**
 * The detail panel's in-situ section (Lot 4.6) — the open asset shown in
 * place where the catalog defines a frame for it, plus "Also see it in
 * place": the OTHER in-situ-capable assets for this kit, each in its own
 * frame, so she sees more of her brand "in the wild" than just the one
 * file she opened.
 */
export function InSituSection({
  brandKitId,
  assetKey,
  availableKeys,
  practiceName,
}: {
  brandKitId: string;
  assetKey: string;
  /** Every catalog key currently rendered for this kit -- only these get a frame. */
  availableKeys: Set<string>;
  practiceName: string;
}) {
  const ownType = IN_SITU_FRAME[assetKey];
  const others = Object.entries(IN_SITU_FRAME).filter(
    ([key, type]) => key !== assetKey && type !== ownType && availableKeys.has(key)
  );

  // Dedup by frame type -- one representative per OTHER frame type is
  // plenty for a "see more of your brand" strip.
  const seen = new Set<FrameType>();
  const strip = others.filter(([, type]) => {
    if (seen.has(type)) return false;
    seen.add(type);
    return true;
  });

  if (!ownType) return null;

  return (
    <div className="flex flex-col gap-4">
      <MonoLabel tracking="10">In place</MonoLabel>
      <FramedAsset brandKitId={brandKitId} assetKey={assetKey} type={ownType} practiceName={practiceName} />

      {strip.length > 0 ? (
        <div>
          <p className="mb-2 text-helper text-ink-2">Also see it in place</p>
          <div className="grid grid-cols-2 gap-3">
            {strip.map(([key, type]) => (
              <button
                key={key}
                type="button"
                onClick={() => track("asset_insitu_viewed", { key: assetKey, frame: type })}
                className="flex flex-col gap-1.5 text-left"
              >
                <FramedAsset brandKitId={brandKitId} assetKey={key} type={type} practiceName={practiceName} />
                <MonoLabel tracking="08">{FRAME_LABEL[type]}</MonoLabel>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
