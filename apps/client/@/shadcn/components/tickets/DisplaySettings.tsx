import { Label } from "@/shadcn/ui/label";
import { Switch } from "@/shadcn/ui/switch";
import useTranslation from "next-translate/useTranslation";
import { UISettings } from "../../types/tickets";

interface DisplaySettingsProps {
  settings: UISettings;
  onChange: (setting: keyof UISettings, value: boolean) => void;
}

export default function DisplaySettings({ settings, onChange }: DisplaySettingsProps) {
  const { t } = useTranslation('peppermint');

  return (
    <div>
      <h4 className="text-sm font-medium mb-3">{t("display_options")}</h4>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="show-avatars" className="text-sm">{t("show_avatars")}</Label>
          <Switch
            id="show-avatars"
            checked={settings.showAvatars}
            onCheckedChange={(checked) => onChange('showAvatars', checked)}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="show-dates" className="text-sm">{t("show_dates")}</Label>
          <Switch
            id="show-dates"
            checked={settings.showDates}
            onCheckedChange={(checked) => onChange('showDates', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-priority" className="text-sm">{t("show_priority")}</Label>
          <Switch
            id="show-priority"
            checked={settings.showPriority}
            onCheckedChange={(checked) => onChange('showPriority', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-type" className="text-sm">{t("show_type")}</Label>
          <Switch
            id="show-type"
            checked={settings.showType}
            onCheckedChange={(checked) => onChange('showType', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-numbers" className="text-sm">{t("show_ticket_numbers")}</Label>
          <Switch
            id="show-numbers"
            checked={settings.showTicketNumbers}
            onCheckedChange={(checked) => onChange('showTicketNumbers', checked)}
          />
        </div>
      </div>
    </div>
  );
} 