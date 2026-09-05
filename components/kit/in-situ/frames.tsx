"use client";

/*
 * In-situ frames (Lot 4.6) — Eklio-drawn, deterministic, generic. No
 * third-party logo or brand mark: a browser chrome is three dots and a
 * bar, a phone frame is a rounded rectangle, a compose window is three
 * plain fields. The point is placement, not impersonating a real product.
 */

export type FrameType = "profile-header" | "compose-window" | "share-card" | "browser-tab" | "business-card-flat";

export const IN_SITU_FRAME: Record<string, FrameType> = {
  avatar_400: "profile-header",
  email_signature_png: "compose-window",
  email_signature_html: "compose-window",
  og_image_1200x630: "share-card",
  favicon_16: "browser-tab",
  favicon_32: "browser-tab",
  apple_touch_icon_180: "browser-tab",
  icon_512: "browser-tab",
  business_card_front: "business-card-flat",
  business_card_back: "business-card-flat",
};

export const FRAME_LABEL: Record<FrameType, string> = {
  "profile-header": "Social profile",
  "compose-window": "Email signature",
  "share-card": "Shared link",
  "browser-tab": "Browser tab",
  "business-card-flat": "Business card",
};

function ProfileHeaderFrame({ imageUrl, practiceName }: { imageUrl: string; practiceName: string }) {
  return (
    <div className="w-full rounded-card border border-line bg-bg p-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL */}
        <img src={imageUrl} alt="" className="size-16 flex-none rounded-full object-cover" />
        <div className="min-w-0">
          <p className="truncate text-body font-semibold text-ink">{practiceName}</p>
          <p className="text-helper text-ink-2">128 posts · 340 followers</p>
        </div>
      </div>
      <div className="mt-3 flex gap-4 border-t border-line pt-3">
        <span className="h-2 w-16 rounded-pill bg-card" />
        <span className="h-2 w-16 rounded-pill bg-card" />
        <span className="h-2 w-16 rounded-pill bg-card" />
      </div>
    </div>
  );
}

function ComposeWindowFrame({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="w-full rounded-card border border-line bg-bg">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        <span className="size-2.5 rounded-pill bg-card" />
        <span className="size-2.5 rounded-pill bg-card" />
        <span className="size-2.5 rounded-pill bg-card" />
        <MonoNote>New message</MonoNote>
      </div>
      <div className="flex flex-col gap-2 p-4 text-helper text-ink-2">
        <p>To: a.colleague@example.com</p>
        <p>Subject: Following up</p>
        <div className="mt-2 border-t border-line pt-3">
          <p>Thanks for your time today — let me know if anything else comes up.</p>
          <div className="mt-4 max-w-[280px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL */}
            <img src={imageUrl} alt="" className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareCardFrame({ imageUrl, practiceName }: { imageUrl: string; practiceName: string }) {
  return (
    <div className="w-full overflow-hidden rounded-card border border-line bg-bg">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL */}
      <img src={imageUrl} alt="" className="aspect-[1200/630] w-full object-cover" />
      <div className="p-3">
        <p className="text-ui text-ink">{practiceName}</p>
        <MonoNote>yourpractice.com</MonoNote>
      </div>
    </div>
  );
}

function BrowserTabFrame({ imageUrl, practiceName }: { imageUrl: string; practiceName: string }) {
  return (
    <div className="w-full overflow-hidden rounded-card border border-line bg-bg">
      <div className="flex items-center gap-2 border-b border-line bg-card px-3 py-2">
        <div className="flex items-center gap-2 rounded-t-check bg-bg px-3 py-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL */}
          <img src={imageUrl} alt="" className="size-4 flex-none" />
          <span className="max-w-[140px] truncate text-meta text-ink-2">{practiceName}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <MonoNote>yourpractice.com</MonoNote>
      </div>
      <div className="h-24 bg-card" />
    </div>
  );
}

function BusinessCardFlatFrame({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="flex w-full items-center justify-center rounded-card border border-line bg-card p-10">
      <div className="w-full max-w-[320px] -rotate-2 overflow-hidden rounded-[6px] shadow-[0_18px_30px_rgba(38,33,28,0.14)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL */}
        <img src={imageUrl} alt="" className="w-full" />
      </div>
    </div>
  );
}

function MonoNote({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-mono-sm uppercase tracking-mono-08 text-ink-3">{children}</span>
  );
}

export function InSituFrame({
  type,
  imageUrl,
  practiceName,
}: {
  type: FrameType;
  imageUrl: string;
  practiceName: string;
}) {
  switch (type) {
    case "profile-header":
      return <ProfileHeaderFrame imageUrl={imageUrl} practiceName={practiceName} />;
    case "compose-window":
      return <ComposeWindowFrame imageUrl={imageUrl} />;
    case "share-card":
      return <ShareCardFrame imageUrl={imageUrl} practiceName={practiceName} />;
    case "browser-tab":
      return <BrowserTabFrame imageUrl={imageUrl} practiceName={practiceName} />;
    case "business-card-flat":
      return <BusinessCardFlatFrame imageUrl={imageUrl} />;
  }
}
