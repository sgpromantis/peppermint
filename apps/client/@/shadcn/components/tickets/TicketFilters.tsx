import { cn } from "@/shadcn/lib/utils";
import { Button } from "@/shadcn/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shadcn/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover";
import { CheckIcon, Filter } from "lucide-react";
import useTranslation from "next-translate/useTranslation";
import { useState } from "react";
import FilterBadge from "./FilterBadge";

interface TicketFiltersProps {
  selectedPriorities: string[];
  selectedStatuses: string[];
  selectedAssignees: string[];
  users: any[];
  onPriorityToggle: (priority: string) => void;
  onStatusToggle: (status: string) => void;
  onAssigneeToggle: (assignee: string) => void;
  onClearFilters: () => void;
}

type FilterType = "priority" | "status" | "assignee" | null;

export default function TicketFilters({
  selectedPriorities,
  selectedStatuses,
  selectedAssignees,
  users,
  onPriorityToggle,
  onStatusToggle,
  onAssigneeToggle,
  onClearFilters,
}: TicketFiltersProps) {
  const { t } = useTranslation('common');
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const [filterSearch, setFilterSearch] = useState("");

  const priorities = ["low", "normal", "high"];
  const statuses = ["open", "closed"];
  const assignees = ["Unassigned", ...users.map(u => u.name)];

  const filteredPriorities = priorities.filter((priority) =>
    priority.toLowerCase().includes(filterSearch.toLowerCase())
  );

  const filteredStatuses = statuses.filter((status) =>
    status.toLowerCase().includes(filterSearch.toLowerCase())
  );

  const filteredAssignees = assignees.filter((assignee) =>
    assignee.toLowerCase().includes(filterSearch.toLowerCase())
  );

  return (
    <div className="flex flex-row items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 bg-transparent">
            <Filter className="mr-2 h-4 w-4" />
            <span className="hidden sm:block">{t("filters")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          {!activeFilter ? (
            <Command>
              <CommandInput 
                placeholder={t("search_filters")} 
                value={filterSearch}
                onValueChange={setFilterSearch}
              />
              <CommandList>
                <CommandEmpty>{t("no_results_found")}</CommandEmpty>
                <CommandGroup>
                  <CommandItem onSelect={() => setActiveFilter("priority")}>
                    {t("priority")}
                  </CommandItem>
                  <CommandItem onSelect={() => setActiveFilter("status")}>
                    {t("status")}
                  </CommandItem>
                  <CommandItem onSelect={() => setActiveFilter("assignee")}>
                    {t("assignee")}
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          ) : (
            <Command>
              <CommandInput 
                placeholder={`Search ${activeFilter}...`}
                value={filterSearch}
                onValueChange={setFilterSearch}
              />
              <CommandList>
                <CommandEmpty>{t("no_results_found")}</CommandEmpty>
                <CommandGroup>
                  {activeFilter === "priority" &&
                    filteredPriorities.map((priority) => (
                      <CommandItem
                        key={priority}
                        onSelect={() => {
                          onPriorityToggle(priority);
                          setActiveFilter(null);
                          setFilterSearch("");
                        }}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            selectedPriorities.includes(priority)
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <CheckIcon className={cn("h-4 w-4")} />
                        </div>
                        <span className="capitalize">{priority}</span>
                      </CommandItem>
                    ))}

                  {activeFilter === "status" &&
                    filteredStatuses.map((status) => (
                      <CommandItem
                        key={status}
                        onSelect={() => {
                          onStatusToggle(status);
                          setActiveFilter(null);
                          setFilterSearch("");
                        }}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            selectedStatuses.includes(status)
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <CheckIcon className={cn("h-4 w-4")} />
                        </div>
                        <span className="capitalize">{status}</span>
                      </CommandItem>
                    ))}

                  {activeFilter === "assignee" &&
                    filteredAssignees.map((assignee) => (
                      <CommandItem
                        key={assignee}
                        onSelect={() => {
                          onAssigneeToggle(assignee);
                          setActiveFilter(null);
                          setFilterSearch("");
                        }}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            selectedAssignees.includes(assignee)
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <CheckIcon className={cn("h-4 w-4")} />
                        </div>
                        {assignee}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>

      <div className="flex flex-wrap gap-2">
        {selectedPriorities.map((priority) => (
          <FilterBadge
            key={`priority-${priority}`}
            text={`Priority: ${priority}`}
            onRemove={() => onPriorityToggle(priority)}
          />
        ))}

        {selectedStatuses.map((status) => (
          <FilterBadge
            key={`status-${status}`}
            text={`Status: ${status}`}
            onRemove={() => onStatusToggle(status)}
          />
        ))}

        {selectedAssignees.map((assignee) => (
          <FilterBadge
            key={`assignee-${assignee}`}
            text={`Assignee: ${assignee}`}
            onRemove={() => onAssigneeToggle(assignee)}
          />
        ))}

        {(selectedPriorities.length > 0 ||
          selectedStatuses.length > 0 ||
          selectedAssignees.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onClearFilters}
          >
            Clear all
          </Button>
        )}
      </div>
    </div>
  );
} 