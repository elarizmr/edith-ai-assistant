import { exec } from "child_process";
import { promisify } from "util";
import { addMemory } from "@/lib/memory";
import { addEvent } from "@/lib/calendar";

const execAsync = promisify(exec);

// Tək istifadəçili sistem olduğu üçün sabit userId
export const USER_ID = process.env.JARVIS_USER_ID || "elariz";

// =========================================================
// TƏHLÜKƏSİZLİK — açıq şəkildə destruktiv əmrlərin qarşısını al
// =========================================================

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
      "Elariz haqqında bir fakt, üstünlük və ya qeydi uzunmüddətli yaddaşa yazır. İstifadəçi 'bunu yadında saxla', 'unutma ki...', 'mən ... sevirəm' kimi bir şey desə, bu tool-u çağır.",
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

      default:
        return `Naməlum alət çağırıldı: ${name}`;
    }
  } catch (error: any) {
    return `Xəta baş verdi: ${error.message}`;
  }
}