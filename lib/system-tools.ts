import { exec, execFile, spawn } from "child_process";
import { promisify } from "util";
import { addMemory } from "@/lib/memory";
import { addEvent } from "@/lib/calendar";
import { searchPlaces, isLead, saveLeads } from "@/lib/leads";
import { getDb } from "@/lib/mongodb";
import { findJobs } from "@/lib/jobs";
import { prepareNextApplication } from "@/lib/apply";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);


export const USER_ID = process.env.JARVIS_USER_ID || "elariz";

const DAILY_LIMIT = 25;

// Mesaj mətnini buradan dəyişə bilərsən
function buildWhatsappText(name: string) {
  return `Salam! Mən Elariz, veb developeram. ${name} üçün internetdə öz saytınızı görmədim. İstəsəniz, sizə sadə və sərfəli bir sayt hazırlaya bilərəm, əvvəlcə nümunə göndərim? Maraqlanmırsınızsa, yazın, bir daha narahat etməyəcəm.`;
}

// "0557902169 - Hesen, 0504615085" -> "994557902169"
function normalizePhone(raw: string): string | null {
  const m = String(raw).match(/\+?\d[\d\s\-()]{7,}\d/);
  let d = (m?.[0] ?? String(raw)).replace(/\D/g, "");
  if (d.startsWith("994")) d = d.slice(3);
  d = d.replace(/^0+/, "");
  return d.length === 9 ? "994" + d : null;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Mətni macOS clipboard-a kopyalayır
function copyToClipboard(text: string) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn("pbcopy");
    p.on("error", reject);
    p.on("close", () => resolve());
    p.stdin.end(text);
  });
}

const DANGEROUS_PATTERNS: RegExp[] = [
  /rm\s+-rf\s+\/(?!\S)/i, // rm -rf /
  /rm\s+-rf\s+~\/?\s*$/i, // rm -rf ~
  /:\(\)\{.*;\s*\}\s*;/, // fork bomb
  /mkfs/i,
  /dd\s+if=.*of=\/dev/i,
  />\s*\/dev\/sd/i,
  /sudo\s+rm/i,
  /diskutil\s+eraseDisk/i,
];

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

// =========================================================
// GEMİNİ FUNCTION-CALLING SXEMASI
// =========================================================

export const toolDeclarations = [
  {
    name: "open_app",
    description:
      "macOS-da bir tətbiqi açır. Məsələn: Safari, Notes, Calendar, Spotify, Terminal, Finder.",
    parameters: {
      type: "object",
      properties: {
        app_name: {
          type: "string",
          description: "Tətbiqin dəqiq adı, məs: 'Safari', 'Notes'",
        },
      },
      required: ["app_name"],
    },
  },
  {
    name: "open_url",
    description: "Default brauzerdə bir URL və ya link açır.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Tam URL, məs: https://google.com" },
      },
      required: ["url"],
    },
  },
  {
    name: "search_files",
    description:
      "Spotlight (mdfind) vasitəsilə komputerdə fayl və ya qovluq axtarır, adına görə.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Axtarılacaq fayl adı və ya açar söz" },
      },
      required: ["query"],
    },
  },
  {
    name: "run_applescript",
    description:
      "macOS-da AppleScript icra edir. Bununla demək olar ki, istənilən Mac tətbiqini idarə etmək olar: Notes-a qeyd yazmaq, Calendar-a event əlavə etmək, Music-i idarə etmək, pəncərələri fokuslamaq, e-mail yazmaq və s. Ən güclü alətdir — mürəkkəb tapşırıqlar üçün bunu üstün tut.",
    parameters: {
      type: "object",
      properties: {
        script: { type: "string", description: "İcra ediləcək tam AppleScript kodu" },
      },
      required: ["script"],
    },
  },
  {
    name: "run_shell_command",
    description:
      "Terminal (bash/zsh) əmri icra edir. Fayl siyahılamaq, sistem məlumatı almaq, proses yoxlamaq kimi zərərsiz əməliyyatlar üçün istifadə et. Silmə/format kimi destruktiv əmrlər avtomatik blok olunur.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "İcra ediləcək shell əmri" },
      },
      required: ["command"],
    },
  },
  {
    name: "set_volume",
    description: "Sistemin səs həcmini 0-100 aralığında tənzimləyir.",
    parameters: {
      type: "object",
      properties: {
        level: { type: "number", description: "0-100 arası dəyər" },
      },
      required: ["level"],
    },
  },
  {
    name: "remember_fact",
    description:
      "Elariz haqqında bir fakt, üstünlük və ya qeydi uzunmüddətli yaddaşa yazır. İstifadəçi 'bunu yadında saxla', 'unutma ki...', 'mən ... sevirəm' kimibir şey desə, bu tool-u çağır.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Yadda saxlanılacaq fakt, qısa və aydın cümlə ilə",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "add_calendar_event",
    description:
      "Elarizin planına yeni tapşırıq/görüş əlavə edir. İstifadəçi 'sabah saat 3-də görüşüm var', 'bunu təqvimə yaz' kimi bir şey desə, bu tool-u çağır.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Tapşırığın/görüşün adı" },
        date: {
          type: "string",
          description:
            "Tarix və saat ISO formatında (məs: 2026-09-14T15:00:00). Əgər il verilməyibsə cari ili istifadə et.",
        },
        description: {
          type: "string",
          description: "Əlavə qeyd (opsional)",
        },
      },
      required: ["title", "date"],
    },
  },
  {
    name: "find_leads",
    description:
      "Xəritə məlumatından (OpenStreetMap) saytı olmayan və ya yalnız Instagram/Facebook-u olan, telefonu olan bizneslər tapır və bazaya yazır. İstifadəçi 'Bakıda saytı olmayan bərbərxanaları tap', 'lead axtar' kimi bir şey desə, bu tool-u çağır. Kateqoriya nümunələri: bərbərxana, gözəllik salonu, restoran, kafe, aptek, diş klinikası, avtoyuma, otel, geyim mağazası, avto servis, idman zalı.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Biznes kateqoriyası, məs: 'bərbərxana'",
        },
        city: {
          type: "string",
          description: "Şəhər adı, məs: 'Bakı'. Verilməyibsə 'Bakı' istifadə et.",
        },
      },
      required: ["category"],
    },
  },
  {
    name: "whatsapp_next_lead",
    description:
      "Bazadakı növbəti 'new' statuslu lead üçün WhatsApp mesajı hazırlayır və wa.me linkini brauzerdə açır. Elariz özü Göndər düyməsini basır. İstifadəçi 'növbəti lead-ə yaz', 'WhatsApp ilə yaz', 'lead-ə mesaj hazırla' kimi bir şey desə, bu tool-u çağır.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "Müəyyən lead-in adı (opsional). Verilməsə növbəti 'new' lead seçilir.",
        },
      },
    },
  },
  {
    name: "find_jobs",
    description:
      "Remotive-dən iş elanlarını tapır, CV-yə uyğunluğa görə bal verir və bazaya yazır. İstifadəçi 'iş tap', 'iş elanlarına bax', 'developer işi axtar' desə, bu tool-u çağır.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Axtarış sözü, məs: 'react developer'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "next_job_application",
    description:
      "Ən yüksək ballı elan üçün motivasiya məktubu hazırlayır, məktubu clipboard-a kopyalayır və elanın səhifəsini brauzerdə açır. Elariz özü yapışdırıb göndərir. İstifadəçi 'növbəti elana müraciət hazırla', 'müraciət et' desə, bu tool-u çağır.",
    parameters: { type: "object", properties: {} },
  },
];

// =========================================================
// İCRA
// =========================================================

export async function executeTool(name: string, args: any): Promise<string> {
  try {
    switch (name) {
      case "open_app": {
        await execAsync(`open -a "${args.app_name}"`);
        return `${args.app_name} açıldı.`;
      }

      case "open_url": {
        await execAsync(`open "${args.url}"`);
        return `${args.url} açıldı.`;
      }

      case "search_files": {
        const { stdout } = await execAsync(
          `mdfind -name "${args.query}" 2>/dev/null | head -10`
        );
        return stdout.trim() || "Heç bir fayl tapılmadı.";
      }

      case "run_applescript": {
        const escaped = String(args.script).replace(/"/g, '\\"');
        const { stdout } = await execAsync(`osascript -e "${escaped}"`);
        return stdout.trim() || "AppleScript uğurla icra olundu.";
      }

      case "run_shell_command": {
        if (isDangerous(args.command)) {
          return "Bu əmr təhlükəli hesab olunur və təhlükəsizlik səbəbindən icra edilmədi.";
        }
        const { stdout, stderr } = await execAsync(args.command, {
          timeout: 10000,
        });
        return (stdout || stderr || "Əmr icra olundu, nəticə boşdur.").trim();
      }

      case "set_volume": {
        const level = Math.max(0, Math.min(100, Number(args.level)));
        await execAsync(`osascript -e "set volume output volume ${level}"`);
        return `Səs ${level}%-ə tənzimləndi.`;
      }

      case "remember_fact": {
        await addMemory(USER_ID, args.content);
        return `Yadda saxladım: "${args.content}"`;
      }

      case "add_calendar_event": {
        const date = new Date(args.date);
        if (isNaN(date.getTime())) {
          return "Tarix formatı düzgün deyil, tapşırıq əlavə olunmadı.";
        }
        await addEvent(USER_ID, args.title, date, args.description);
        return `Təqvimə əlavə etdim: "${args.title}" — ${date.toLocaleString("az-AZ")}`;
      }

      case "find_leads": {
        const category = String(args.category || "").trim();
        const city = String(args.city || "Bakı").trim();
        if (!category) return "Kateqoriya deyilməyib, axtarış edilmədi.";

        const places = await searchPlaces(category, city);
        const leads = places.filter(isLead);
        const added = await saveLeads(leads, category, city);

        if (leads.length === 0) {
          return `${city} üzrə ${places.length} məkan tapıldı, amma saytı olmayan və telefonu olan lead çıxmadı.`;
        }

        const firstPhone = (s: string) =>
          String(s).match(/\+?\d[\d\s]{7,}\d/)?.[0]?.trim() ?? s;

        const list = leads
          .slice(0, 8)
          .map(
            (p: any) =>
              `${p.displayName?.text} (${firstPhone(
                p.internationalPhoneNumber ?? p.nationalPhoneNumber
              )})`
          )
          .join("; ");

        return `${city} üzrə ${places.length} məkan baxıldı, ${leads.length} lead tapıldı, ${added} yeni bazaya yazıldı. Bəziləri: ${list}.`;
      }

      case "whatsapp_next_lead": {
        const db = await getDb();
        const col = db.collection("leads");

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const sentToday = await col.countDocuments({
          "messages.at": { $gte: startOfDay },
        });
        if (sentToday >= DAILY_LIMIT) {
          return `Bu gün artıq ${DAILY_LIMIT} mesaj hazırlanıb, limit dolub. Sabah davam edərik.`;
        }

        const filter: any = args.name
          ? {
              name: { $regex: escapeRegex(String(args.name)), $options: "i" },
              status: { $ne: "do_not_contact" },
            }
          : { status: "new" };

        const lead = await col.findOne(filter, { sort: { createdAt: 1 } });
        if (!lead) return "Yazılacaq yeni lead qalmayıb.";

        const phone = normalizePhone(lead.phone);
        if (!phone) {
          await col.updateOne({ _id: lead._id }, { $set: { status: "bad_phone" } });
          return `${lead.name} üçün düzgün nömrə tapılmadı, onu keçdim.`;
        }

        const text = buildWhatsappText(lead.name);
        await execAsync(
          `open "https://wa.me/${phone}?text=${encodeURIComponent(text)}"`
        );
        await col.updateOne(
          { _id: lead._id },
          {
            $set: { status: "contacted" },
            $push: {
              messages: { at: new Date(), channel: "whatsapp", direction: "out", text },
            },
          } as any
        );
        return `${lead.name} üçün WhatsApp açıldı, mesaj hazırdır. Göndər düyməsini özün bas.`;
      }

      case "find_jobs": {
        const query = String(args.query || "").trim();
        if (!query) return "Axtarış sözü deyilməyib.";
        const added = await findJobs(query);
        return `${added} uyğun elan tapıldı və bazaya yazıldı.`;
      }

      case "next_job_application": {
        const app = await prepareNextApplication();
        if (!app) return "Hazırlanacaq yeni elan qalmayıb. Əvvəl iş axtarışı et.";
        await copyToClipboard(app.coverLetter);
        await execFileAsync("open", [app.url]);
        return `${app.company} şirkətinin ${app.title} elanı açıldı, uyğunluq balı ${app.score}. Məktub clipboard-dadır, yapışdırıb özün göndər.`;
      }

      default:
        return `Naməlum alət çağırıldı: ${name}`;
    }
  } catch (error: any) {
    return `Xəta baş verdi: ${error.message}`;
  }
}