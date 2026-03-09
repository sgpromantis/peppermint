import { KanbanGrouping, SortOption, Ticket, UISettings, ViewMode } from '@/shadcn/types/tickets';
import useTranslation from 'next-translate/useTranslation';
import { useEffect, useState } from 'react';

export function useTicketView(tickets: Ticket[] = []) {
  const { t } = useTranslation('peppermint');

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("preferred_view_mode");
    return (saved as ViewMode) || 'list';
  });

  const [kanbanGrouping, setKanbanGrouping] = useState<KanbanGrouping>(() => {
    const saved = localStorage.getItem("preferred_kanban_grouping");
    return (saved as KanbanGrouping) || 'status';
  });

  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem("preferred_sort_by");
    return (saved as SortOption) || 'newest';
  });

  const [uiSettings, setUISettings] = useState<UISettings>(() => {
    const saved = localStorage.getItem("preferred_ui_settings");
    return saved ? JSON.parse(saved) : {
      showAvatars: true,
      showDates: true,
      showPriority: true,
      showType: true,
      showTicketNumbers: true,
    };
  });

  useEffect(() => {
    localStorage.setItem("preferred_view_mode", viewMode);
    localStorage.setItem("preferred_kanban_grouping", kanbanGrouping);
    localStorage.setItem("preferred_sort_by", sortBy);
    localStorage.setItem("preferred_ui_settings", JSON.stringify(uiSettings));
  }, [viewMode, kanbanGrouping, sortBy, uiSettings]);

  const handleUISettingChange = (setting: keyof UISettings, value: boolean) => {
    setUISettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const sortedTickets = [...tickets].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'priority':
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority.toLowerCase()] - priorityOrder[b.priority.toLowerCase()];
      case 'title':
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

  const kanbanColumns = (() => {
    switch (kanbanGrouping) {
      case 'status':
        return [
          {
            id: 'needs_support',
            title: t('needs_support'),
            color: 'bg-yellow-500',
            tickets: sortedTickets.filter(tk => tk.status === 'needs_support'),
          },
          {
            id: 'in_progress',
            title: t('in_progress'),
            color: 'bg-blue-500',
            tickets: sortedTickets.filter(tk => tk.status === 'in_progress'),
          },
          {
            id: 'in_review',
            title: t('in_review'),
            color: 'bg-purple-500',
            tickets: sortedTickets.filter(tk => tk.status === 'in_review'),
          },
          {
            id: 'hold',
            title: t('hold'),
            color: 'bg-orange-500',
            tickets: sortedTickets.filter(tk => tk.status === 'hold'),
          },
          {
            id: 'done',
            title: t('done'),
            color: 'bg-green-500',
            tickets: sortedTickets.filter(tk => tk.status === 'done'),
          },
        ];
      case 'priority':
        return [
          {
            id: 'high',
            title: t('high'),
            color: 'bg-red-500',
            tickets: sortedTickets.filter(tk => tk.priority.toLowerCase() === 'high'),
          },
          {
            id: 'normal',
            title: t('normal'),
            color: 'bg-green-500',
            tickets: sortedTickets.filter(tk => tk.priority.toLowerCase() === 'normal'),
          },
          {
            id: 'low',
            title: t('low'),
            color: 'bg-blue-500',
            tickets: sortedTickets.filter(tk => tk.priority.toLowerCase() === 'low'),
          },
        ];
      case 'type':
        return [
          {
            id: 'bug',
            title: t('bug'),
            color: 'bg-red-500',
            tickets: sortedTickets.filter(tk => tk.type === 'bug'),
          },
          {
            id: 'feature',
            title: t('feature'),
            color: 'bg-blue-500',
            tickets: sortedTickets.filter(tk => tk.type === 'feature'),
          },
          // Add other type columns as needed
        ];
      case 'assignee':
        const assignees = Array.from(new Set(sortedTickets.map(tk => tk.assignedTo?.name || t('unassigned'))));
        return assignees.map(assignee => ({
          id: assignee.toLowerCase(),
          title: assignee,
          color: 'bg-teal-500',
          tickets: sortedTickets.filter(tk => (tk.assignedTo?.name || t('unassigned')) === assignee),
        }));
      default:
        return [];
    }
  })();

  return {
    viewMode,
    kanbanGrouping,
    sortBy,
    setViewMode,
    setKanbanGrouping,
    setSortBy,
    sortedTickets,
    kanbanColumns,
    uiSettings,
    handleUISettingChange,
  };
}
