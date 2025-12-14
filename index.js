const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Imap = require('node-imap');
const simpleParser = require('mailparser').simpleParser;
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
// Import knihovny AXIOS pro spolehlivější HTTP požadavky
const axios = require('axios'); 

// === DŮLEŽITÉ NASTAVENÍ (ZMĚŇTE TYTO HODNOTY) ===
// POUŽIJTE ID CHATU VE FORMÁTU: '1245487464897489@g.us
// 1. CÍLOVÝ CHAT pro TEAMS zprávy (Původní cíl)
const CILOVY_CHAT_ID_TEAMS = '@g.us'; 

// ⚠️ 2. CÍLOVÝ CHAT pro ROZVRH (Změny z Bakaláři) - AKTUALIZOVÁNO!
const CILOVY_CHAT_ID_ROZVRH = '@g.us'; 

// Emailové nastavení (Teams bridge)
const EMAIL_ADRESA = 'x.x@gmail.com'; 
const EMAIL_HESLO = 'secretpassword'; 
const IMAP_HOST = 'imap.gmail.com'; 
const IMAP_PORT = 993; 
const KONTROLNI_PREDMET = '[TEAMS_BRIDGE_ZPRAVA]'; 
const INTERVAL_KONTROLY = 60000; // Kontrola Teams mailů každých 60 sekund

// =======================================================
//       1. NASTAVENÍ ÚDAJŮ ROZVRHU BAKALÁŘI
// =======================================================
const BASE_URL = "https://bakalari.gymbk.cz/bakaweb";
const USERNAME = "pacmat31s"; 
const PASSWORD = "te2*2Ava"; 
const HISTORY_FILE_TEAMS = 'sent_messages.json'; // Historie pro Teams zprávy
const HISTORY_FILE_SCHEDULE = 'last_known_schedule.json'; // Historie pro rozvrh

const DAY_NAMES = {
    1: "Po", 2: "Ut", 3: "St", 4: "Ct", 5: "Pa", 6: "So", 7: "Ne"
};
const ROZVRH_KONTROLA_INTERVAL = 15 * 60 * 1000; // Kontrola rozvrhu každých 15 minut

// === Globální proměnné a pomocné funkce ===

let sentMessagesHistory = loadHistory(HISTORY_FILE_TEAMS); 

function loadHistory(filename) {
    try {
        if (fs.existsSync(filename)) {
            const data = fs.readFileSync(filename, 'utf8');
            return new Set(JSON.parse(data));
        }
    } catch (e) {
        console.error(`Chyba při načítání historie (${filename}):`, e.message);
    }
    return new Set();
}

function saveHistory(history, filename) {
    try {
        fs.writeFileSync(filename, JSON.stringify(Array.from(history)), 'utf8');
    } catch (e) {
        console.error(`Chyba při ukládání historie (${filename}):`, e.message);
    }
}

function getHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}


// === 2. Funkce pro získání Tokenu a Rozvrhu (Používá AXIOS) ===

async function loginToBakalari(baseUrl, username, password) {
    const LOGIN_ENDPOINT = `${baseUrl}/api/login`;
    const headers = {'Content-Type': 'application/x-www-form-urlencoded'};
    const payload = new URLSearchParams({
        client_id: 'ANDR',
        grant_type: 'password',
        username: username,
        password: password
    });
    
    try {
        const response = await axios.post(LOGIN_ENDPOINT, payload.toString(), {
            headers: headers
        });
        
        return response.data.access_token;
    } catch (e) {
        if (e.response) {
            console.error(`Chyba přihlašování Bakaláři (Status ${e.response.status}): ${e.response.data.error_description || 'Neznámá chyba.'}`);
        } else {
            console.error(`Chyba při přihlašování k Bakaláři: ${e.message}`);
        }
        return null;
    }
}

async function getSchedule(baseUrl, accessToken) {
    if (!accessToken) {
        console.error("Chyba: Přístupový token je prázdný.");
        return null;
    }
    
    const SCHEDULE_ENDPOINT = `${baseUrl}/api/3/timetable/actual`;
    
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Android', 
        'Content-Type': 'application/json' 
    };
    
    try {
        const response = await axios.get(SCHEDULE_ENDPOINT, { 
            headers: headers 
        });
        
        return response.data;
        
    } catch (e) {
        if (e.response) {
            if (e.response.status === 500) {
                const errorBody = JSON.stringify(e.response.data);
                console.error(`CHYBA 500: Server Bakaláři vrátil chybu. Tělo chyby: ${errorBody.substring(0, 100)}...`);
                return null;
            }
            throw new Error(`Chyba HTTP: ${e.response.status} ${e.response.statusText}`);
        }
        console.error(`Chyba při získávání rozvrhu: ${e.message}`);
        return null;
    }
}


// === 3. Funkce pro generování kompletního rozvrhu (nově) ===

function generateFullScheduleMessage(schedule) {
    let output = "";
    
    const hoursInfo = {};
    for (const hour of schedule.Hours || []) {
        if (hour.Id !== undefined) {
            hoursInfo[hour.Id] = {
                TimeFrom: hour.BeginTime || "??:??",
                TimeTo: hour.EndTime || "??:??"
            };
        }
    }

    output += "*------------------------------------*\n";
    output += "*📅 ÚPLNÝ TÝDENNÍ ROZVRH (AKTUALIZOVANÝ) 📅*\n";
    output += "*------------------------------------*\n";
    
    for (const day of schedule.Days || []) {
        const dayDateFull = (day.Date || "").split('T')[0];
        let dayName = "Chyba";
        let formattedDate = dayDateFull;
        try {
            const dateObj = new Date(dayDateFull);
            const isoWeekday = dateObj.getDay() === 0 ? 7 : dateObj.getDay();
            dayName = DAY_NAMES[isoWeekday] || "N/A";
            // Formát data DD.MM.
            formattedDate = dateObj.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' }); 
        } catch (e) { }
        
        output += `\n*=== ${dayName}, ${formattedDate} ===*\n`;
        
        const lessonsByHour = {};
        for (const lesson of day.Atoms || []) {
            const hourId = lesson.HourId;
            if (hourId !== undefined && lesson.SubjectId !== undefined) {
                if (!lessonsByHour[hourId]) lessonsByHour[hourId] = [];
                lessonsByHour[hourId].push(lesson);
            }
        }
            
        const sortedHourIds = Object.keys(lessonsByHour).map(Number).sort((a, b) => a - b);
        
        if (sortedHourIds.length === 0) {
            output += "✅ Volný den.\n";
            continue;
        }
            
        for (const hourId of sortedHourIds) {
            const lessons = lessonsByHour[hourId];
            const hourTimes = hoursInfo[hourId] || {"TimeFrom": "??:??", "TimeTo": "??:??"};
            
            for (const lesson of lessons) {
                const getAbbrev = (id, type) => {
                    const collection = schedule[type] || [];
                    const item = collection.find(i => i.Id === id);
                    return item ? item.Abbrev : "N/A";
                };

                let subject = getAbbrev(lesson.SubjectId, "Subjects");
                let teacher = getAbbrev(lesson.TeacherId, "Teachers");
                let room = getAbbrev(lesson.RoomId, "Rooms");
                
                let line = `${hourTimes.TimeFrom}: ${subject} (${room}, ${teacher})`;
                
                const changeData = lesson.Change;
                if (changeData) {
                    if (changeData.ChangeType === "Canceled") {
                        line = `❌ ${hourTimes.TimeFrom}: *ZRUŠENO* (${changeData.Description || 'Důvod neuveden'})`;
                    } else if (changeData.ChangeType === "Substitution") {
                        line = `🔄 ${hourTimes.TimeFrom}: *SUPLOVÁNÍ* - ${subject} (${room}, ${teacher}) - (${changeData.Description || 'Změna'})`;
                    }
                }
                
                output += line + "\n";
                
                const homeworks = lesson.Homeworks || [];
                if (homeworks.length > 0) {
                    // Zobrazit pouze první 50 znaků DÚ pro stručnost
                    output += "   📝 Nový DU: " + homeworks.map(hw => (hw.Text || 'Není uvedeno.').replace(/\r\n|\n|<br \/>/g, ' ').trim().substring(0, 50) + '...').join('; ') + "\n";
                }
            }
        }
    }
    return output;
}


// === 4. Funkce pro porovnání a uložení rozvrhu (generuje notifikaci) ===

function compareAndSaveSchedule(currentSchedule) {
    // Generujeme řetězec rozvrhu pro porovnání, aby se ignorovalo pořadí klíčů
    const currentScheduleStr = JSON.stringify(currentSchedule, Object.keys(currentSchedule).sort(), 4);
    let lastScheduleStr = "";
    
    try {
        if (fs.existsSync(HISTORY_FILE_SCHEDULE)) {
            lastScheduleStr = fs.readFileSync(HISTORY_FILE_SCHEDULE, 'utf8');
        }
    } catch (e) {
        lastScheduleStr = ""; 
    }
        
    // Pokud jsou řetězce stejné, rozvrh se nezměnil
    if (currentScheduleStr === lastScheduleStr) {
        return ""; // Rozvrh beze změn
    }
    
    // Změna zjištěna: Uložíme nový rozvrh
    try {
        fs.writeFileSync(HISTORY_FILE_SCHEDULE, currentScheduleStr, 'utf8');
    } catch (e) {
        console.error(`Chyba při ukládání souboru historie rozvrhu: ${e.message}`);
    }

    // Změna zjištěna: Vygenerujeme a odešleme CELÝ rozvrh
    const fullScheduleMessage = generateFullScheduleMessage(currentSchedule);
    
    return fullScheduleMessage;
}


// === 5. Funkce pro kontrolu rozvrhu (Volána po spuštění a pravidelně) ===

async function checkSchedule() {
    console.log(`\n--- Kontrola rozvrhu Bakaláři (${new Date().toLocaleTimeString()}) ---`);
    const token = await loginToBakalari(BASE_URL, USERNAME, PASSWORD);
    
    if (!token) {
        console.error("Nelze získat token. Přeskočeno.");
        return;
    }
    
    const scheduleData = await getSchedule(BASE_URL, token);
    
    if (!scheduleData) {
        console.error("Nelze získat data rozvrhu. Přeskočeno.");
        return;
    }
    
    // 1. Kontrola změny a generování notifikační zprávy
    const resultMessage = compareAndSaveSchedule(scheduleData);
    
    if (resultMessage && resultMessage.trim() !== "") {
        console.log("!!! ZMĚNA ROZVRHU ZJIŠTĚNA. ODESÍLÁM KOMPLETNÍ ROZVRH !!!");
        // ODESÍLÁ ZMĚNY ROZVRHU DO NOVÉHO CHATU
        await client.sendMessage(CILOVY_CHAT_ID_ROZVRH, resultMessage);
    } else {
        console.log("Rozvrh beze změn. Zpráva neodeslána.");
    }

    console.log("--- Kontrola rozvrhu dokončena ---");
}

// === Původní funkce pro kontrolu E-mailů (IMAP) ===
function checkEmail() {
    
    const imap = new Imap({
        user: EMAIL_ADRESA,
        password: EMAIL_HESLO,
        host: IMAP_HOST,
        port: IMAP_PORT,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }
    });

    imap.once('ready', () => {
        imap.openBox('WHATSAPP_TEAMS_BRIDGE', true, (err, box) => { 
            if (err) {
                console.error("IMAP: Chyba při otevírání schránky:", err.message);
                imap.end();
                return;
            }
            
            console.log(`IMAP: Připojeno. Hledám Teams zprávy (${new Date().toLocaleTimeString()})...`);

            imap.search([['SUBJECT', KONTROLNI_PREDMET]], (err, results) => {
                if (err) {
                    console.error("IMAP: Chyba při hledání emailů:", err);
                    imap.end();
                    return;
                }

                if (!results || results.length === 0) {
                    imap.end();
                    return;
                }

                console.log(`IMAP: Nalezeno ${results.length} Teams zpráv ke kontrole.`);
                
                const f = imap.fetch(results, { bodies: '', struct: true });
                let messagesProcessed = 0;

                f.on('message', (msg, seqno) => {
                    let data = '';
                    msg.on('body', (stream) => {
                        stream.on('data', (chunk) => {
                            data += chunk.toString('utf8');
                        });
                    });

                    msg.once('end', async () => {
                        const email = await simpleParser(data);
                        
                        try {
                            const emailContent = email.text.trim();
                            const messageHash = getHash(emailContent);

                            if (sentMessagesHistory.has(messageHash)) {
                                messagesProcessed++;
                                return;
                            }
                            
                            let waMessage = `📨 *Teams zpráva:*\n\n${emailContent}`;
                            waMessage = waMessage.replace(/\n\s*\n/g, '\n');
                            
                            // ODESÍLÁ TEAMS ZPRÁVY DO PŮVODNÍHO CHATU 
                            await client.sendMessage(CILOVY_CHAT_ID_TEAMS, waMessage);
                            console.log(`WhatsApp: Teams zpráva ${seqno} úspěšně přeposlána.`);
                            
                            sentMessagesHistory.add(messageHash);
                            saveHistory(sentMessagesHistory, HISTORY_FILE_TEAMS);

                        } catch (e) {
                            console.error('CHYBA: Zpracování e-mailu nebo odesílání do WhatsAppu selhalo:', e.message);
                        } finally {
                            messagesProcessed++;
                            if (messagesProcessed === results.length) {
                                imap.end();
                            }
                        }
                    });
                });

                f.once('end', () => {
                });
            }); 
        }); 
    }); 

    imap.once('error', (err) => {
        console.error('IMAP: Chyba připojení:', err.message);
        imap.end();
    });

    imap.connect();
}


// === HLAVNÍ BĚH KÓDU (Iniciační logika) ===

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--no-zygote'],
        headless: true
    }
});

client.on('qr', (qr) => {
    console.log('Naskenuj tento QR kód svým WhatsAppem:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('>>> WhatsApp klient je připraven! <<<');
    
    // Spuštění kontroly Teams mailů
    setInterval(checkEmail, INTERVAL_KONTROLY); 
    console.log(`Spuštěna pravidelná kontrola Teams pošty každých ${INTERVAL_KONTROLY / 1000} sekund.`);
    
    // Spuštění kontroly rozvrhu Bakaláři
    checkSchedule(); // První spuštění hned po startu
    setInterval(checkSchedule, ROZVRH_KONTROLA_INTERVAL);
    console.log(`Spuštěna pravidelná kontrola rozvrhu každých ${ROZVRH_KONTROLA_INTERVAL / 60000} minut.`);
});

client.on('auth_failure', () => {
    console.error('CHYBA: WhatsApp selhalo ověření.');
});

client.initialize();
