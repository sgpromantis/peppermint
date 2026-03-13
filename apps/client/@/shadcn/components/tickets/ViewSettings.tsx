import { Button } from "@/shadcn/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover";
import { Separator } from "@/shadcn/ui/separator";
import { Settings } from "lucide-react";
import useTranslation from "next-translate/useTranslation";
import { KanbanGrouping, SortOption, UISettings, ViewMode } from '../../types/tickets';
import DisplaySettings from "./DisplaySettings";

interface ViewSettingsProps {
  viewMode: ViewMode;
  kanbanGrouping: KanbanGrouping;
  sortBy: SortOption;
  uiSettings: UISettings;
  onViewModeChange: (mode: ViewMode) => void;
  onKanbanGroupingChange: (grouping: KanbanGrouping) => void;
  onSortChange: (sort: SortOption) => void;
  onUISettingChange: (setting: keyof UISettings, value: boolean) => void;
}

export default function ViewSettings({
  viewMode,
  kanbanGrouping,
  sortBy,
  uiSettings,
  onViewModeChange,
  onKanbanGroupingChange,
  onSortChange,
  onUISettingChange,
}: ViewSettingsProps) {
  const { t } = useTranslation('common');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8">
          <Settings className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">{t("settings")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[240px] p-3" 
        align="end" 
        side={viewMode === 'kanban' ? 'left' : 'bottom'}
        sideOffset={8}
      >
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">{t("view_mode")}</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onViewModeChange('list')}
                className="w-full"
              >
                {t("list_view")}
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onViewModeChange('kanban')}
                className="w-full"
              >
                {t("kanban_view")}
              </Button>
            </div>
          </div>
          
          {viewMode === 'list' && (
            <div>
              <h4 className="text-sm font-medium mb-2">{t("sort_by")}</h4>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant={sortBy === 'newest' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSortChange('newest')}
                  className="w-full justify-start"
                >
                  {t("newest_first")}
                </Button>
                <Button
                  variant={sortBy === 'oldest' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSortChange('oldest')}
                  className="w-full justify-start"
                >
                  {t("oldest_first")}
                </Button>
                <Button
                  variant={sortBy === 'priority' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSortChange('priority')}
                  className="w-full justify-start"
                >
                  {t("priority")}
                </Button>
                <Button
                  variant={sortBy === 'title' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSortChange('title')}
                  className="w-full justify-start"
                >
                  {t("title")}
                </Button>
              </div>
            </div>
          )}
          
          {viewMode === 'kanban' && (
            <div>
              <h4 className="text-sm font-medium mb-2">{t("group_by")}</h4>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant={kanbanGrouping === 'status' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onKanbanGroupingChange('status')}
                  className="w-full justify-start"
                >
                  {t("status")}
                </Button>
                <Button
                  variant={kanbanGrouping === 'priority' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onKanbanGroupingChange('priority')}
                  className="w-full justify-start"
                >
                  {t("priority")}
                </Button>
                <Button
                  variant={kanbanGrouping === 'type' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onKanbanGroupingChange('type')}
                  className="w-full justify-start"
                >
                  {t("type")}
                </Button>
                <Button
                  variant={kanbanGrouping === 'assignee' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onKanbanGroupingChange('assignee')}
                  className="w-full justify-start"
                >
                  {t("assignee")}
                </Button>
              </div>
            </div>
          )}
          
          <Separator />
          
          <DisplaySettings 
            settings={uiSettings} 
            onChange={onUISettingChange}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
} 