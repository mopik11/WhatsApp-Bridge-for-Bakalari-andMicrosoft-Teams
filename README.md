# WhatsApp-Bridge-for-Bakalari-andMicrosoft-Teams
Tento projekt implementuje Node.js bota, který slouží jako "most" (bridge) pro automatické přeposílání zpráv z **Microsoft Teams** (přes email) a aktualizací rozvrhu z **Bakaláři (API)** do specifických skupinových chatů na **WhatsAppu**.



## 💡 Klíčové Funkce

1.  **Teams Email Bridge:** Pravidelná kontrola specifické IMAP schránky pro zprávy s předmětem `[TEAMS_BRIDGE_ZPRAVA]` a jejich přeposílání do cílového WhatsApp chatu.
2.  **Bakaláři Rozvrh Notifikace:** Pravidelné přihlašování do systému Bakaláři (pomocí interního API) a kontrola změn v rozvrhu. Při zjištění změny je odeslán kompletní, aktualizovaný rozvrh do druhého cílového WhatsApp chatu.

## 🛠️ Požadavky

* Node.js (verze 18+)
* WhatsApp účet, který bude sloužit jako bot
* Přístup k IMAP serveru pro příjem Teams zpráv (např. dedikovaný Gmail účet)
* Přihlašovací údaje do systému Bakaláři

## 🚀 Instalace a Spuštění

### 1. Klonování Repozitáře

```bash
git clone [VÁŠ_REPOZITÁŘ_URL]
cd [VÁŠ_REPOZITÁŘ]
