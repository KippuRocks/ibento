import type { ReactNode } from "react";
import type { ChromeId, ScreenId } from "./registry";
import { hrefOf, type ParamsOf, type RoutedScreenId } from "./router";

/**
 * A link to a screen. `from` names the screen, or chrome, the link is shown on,
 * literally, so `tools/screens` can record the edge in `screens.json`.
 */
export function ScreenLink<Id extends RoutedScreenId>({
  to,
  params,
  className,
  children,
}: {
  from: ScreenId | `chrome:${ChromeId}`;
  to: Id;
  params: ParamsOf<Id>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={hrefOf(to, params)} className={className}>
      {children}
    </a>
  );
}
