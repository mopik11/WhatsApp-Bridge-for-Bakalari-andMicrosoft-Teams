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

git clone https://github.com/mopik11/WhatsApp-Bridge-for-Bakalari-andMicrosoft-Teams.git
cd WhatsApp-Bridge-for-Bakalari-andMicrosoft-Teams

### 2. Instalace Závislostí

npm install whatsapp-web.js qrcode-terminal node-imap mailparser fs crypto path axios

### 3. Konfigurace DŮLEŽITÉ: Před spuštěním musíte v souboru se skriptem (index.js nebo app.js) nahradit zástupné hodnoty za skutečné hodnoty:
CILOVY_CHAT_ID_TEAMSID WhatsApp chatu pro Teams zprávy. - > '1234567890@g.us' 
CILOVY_CHAT_ID_ROZVRHID WhatsApp chatu pro rozvrh Bakaláři. - > '0987654321@g.us'E
MAIL_ADRESA Email pro kontrolu Teams zpráv. - > 'bot.email@gmail.com'
EMAIL_HESLO Heslo/App Password k emailu.'aplication_password'
USERNAME / PASSWORD Přihlašovací údaje do Bakaláři. - > 'uživatelské jméno' / 'heslo'
