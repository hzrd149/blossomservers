import { useEffect, useState } from "react";

/** Returns true once the element has scrolled into view, and stays true */
export function useInView<T extends Element>(element: T | null, rootMargin = "200px") {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!element || inView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, inView, rootMargin]);

  return inView;
}
