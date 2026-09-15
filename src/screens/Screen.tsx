import { type ReactNode, useEffect } from "react";
import { SCREENS, type ScreenId } from "./registry";

/**
 * A screen's root: carries its `screenId` in the rendered tree as `data-screen`
 * (`F-070` plan §5.4), so a test can tell which screen it is on without reading
 * copy, and titles the document after it.
 */
export function Screen({ id, children }: { id: ScreenId; children: ReactNode }) {
  useEffect(() => {
    document.title = `${SCREENS[id].title} · Ibento`;
  }, [id]);
  return (
    <div data-screen={id} className="screen">
      {children}
    </div>
  );
}
