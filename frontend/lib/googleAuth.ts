declare global {
  interface Window {
    google?: any;
  }
}

let googleScriptPromise: Promise<void> | null = null;

export function loadGoogleScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export function renderGoogleButton(
  container: HTMLElement,
  clientId: string,
  onCredential: (credential: string) => void
) {
  if (!window.google?.accounts?.id) throw new Error("Google Identity API unavailable");

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response: { credential?: string }) => {
      if (response?.credential) onCredential(response.credential);
    },
  });

  container.innerHTML = "";
  window.google.accounts.id.renderButton(container, {
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "pill",
    width: 360,
  });
}
