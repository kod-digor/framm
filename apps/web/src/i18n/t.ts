import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type messages from "../../messages/fr.json";

type Namespace = keyof typeof messages;

export async function getT(namespace?: Namespace) {
  return getTranslations(namespace);
}

export function useT(namespace?: Namespace) {
  return useTranslations(namespace);
}
