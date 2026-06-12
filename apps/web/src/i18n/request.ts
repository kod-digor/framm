import { IntlErrorCode } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import messages from "../../messages/fr.json";

export default getRequestConfig(async () => {
  const locale = "fr";

  return {
    locale,
    messages,
    onError(error) {
      if (error.code === IntlErrorCode.MISSING_MESSAGE) {
        console.error(`[i18n] ${error.message}`);
        return;
      }
      throw error;
    },
    getMessageFallback({ namespace, key }) {
      const path = namespace ? `${namespace}.${key}` : key;
      console.warn(`[i18n] fallback for missing key: ${path}`);
      return path;
    },
  };
});
