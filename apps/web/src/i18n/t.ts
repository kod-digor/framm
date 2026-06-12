import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

export async function getT(namespace?: string) {
  return getTranslations(namespace);
}

export function useT(namespace?: string) {
  return useTranslations(namespace);
}
