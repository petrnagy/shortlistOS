/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-08-01
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
export const webClipperDictionary = {
  en: {
    brand: "shortlistOS",
    consent: {
      pageTitle: "Connect shortlistOS Web Clipper",
      heading: "Connect Web Clipper",
      description:
        "Save job opportunities directly to your shortlists. Requested access:",
      signedInAs: "Signed in as",
      cancel: "Cancel",
      allow: "Allow Web Clipper",
      privacy: "You can disconnect the Web Clipper at any time.",
    },
    completion: {
      approvedPageTitle: "Web Clipper connected",
      deniedPageTitle: "Web Clipper connection cancelled",
      approvedHeading: "Web Clipper connected",
      deniedHeading: "Connection cancelled",
      approvedDescription:
        "The Web Clipper is ready. Return to the extension to save your first opportunity.",
      deniedDescription:
        "No access was granted. You can reconnect from the Web Clipper whenever you are ready.",
      closeTab: "Close this tab",
      closeFallback: "If the tab stays open, you can close it manually.",
    },
    scopes: {
      "profile:read": "View your profile",
      "boards:read": "View your active shortlists",
      "clips:create": "Send pages you explicitly save",
      "clips:read": "Check saved-page processing status",
    },
  },
} as const;

export const webClipperStrings = webClipperDictionary.en;
