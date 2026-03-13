// @ts-nocheck
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/shadcn/ui/command";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/shadcn/ui/context-menu";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import { getCookie } from "cookies-next";
import moment from "moment";
import useTranslation from "next-translate/useTranslation";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import Frame from "react-frame-component";
import { useQuery } from "react-query";
import { useDebounce } from "use-debounce";

import { toast } from "@/shadcn/hooks/use-toast";
import { hasAccess } from "@/shadcn/lib/hasAccess";
import { cn } from "@/shadcn/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shadcn/ui/avatar";
import { Button } from "@/shadcn/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shadcn/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover";
import { Switch } from "@/shadcn/ui/switch";
import {
  CheckIcon,
  CircleCheck,
  CircleDotDashed,
  Clock,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  LifeBuoy,
  Loader,
  LoaderCircle,
  Lock,
  Mail,
  Paperclip,
  PanelTopClose,
  Pause,
  Play,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Tag,
  Trash2,
  Unlock,
} from "lucide-react";
import { useUser } from "../../store/session";
import { ClientCombo, IconCombo, UserCombo } from "../Combo";

const ticketStatusKeys = [
  { id: 0, value: "hold", nameKey: "hold", icon: CircleDotDashed },
  { id: 1, value: "needs_support", nameKey: "needs_support", icon: LifeBuoy },
  { id: 2, value: "in_progress", nameKey: "in_progress", icon: CircleDotDashed },
  { id: 3, value: "in_review", nameKey: "in_review", icon: Loader },
  { id: 4, value: "done", nameKey: "done", icon: CircleCheck },
];

const priorityKeys = [
  { id: "1", nameKey: "low", value: "low", icon: SignalLow },
  { id: "2", nameKey: "medium", value: "medium", icon: SignalMedium },
  { id: "3", nameKey: "high", value: "high", icon: SignalHigh },
];

export default function Ticket() {
  const router = useRouter();
  const { t } = useTranslation("common");

  const ticketStatusMap = ticketStatusKeys.map((s) => ({
    ...s,
    name: t(s.nameKey),
  }));

  const priorityOptions = priorityKeys.map((p) => ({
    ...p,
    name: t(p.nameKey),
  }));

  const token = getCookie("session");

  const { user } = useUser();

  const fetchTicketById = async () => {
    const id = router.query.id;
    const res = await fetch(`/api/v1/ticket/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    hasAccess(res);

    return res.json();
  };

  const { data, status, refetch } = useQuery("fetchTickets", fetchTicketById, {
    enabled: false,
  });

  useEffect(() => {
    refetch();
  }, [router]);

  const [initialContent, setInitialContent] = useState<
    PartialBlock[] | undefined | "loading"
  >("loading");

  const editor = useMemo(() => {
    if (initialContent === "loading") {
      return undefined;
    }
    return BlockNoteEditor.create({ initialContent });
  }, [initialContent]);

  const [edit, setEdit] = useState(false);
  const [editTime, setTimeEdit] = useState(false);
  const [assignedEdit, setAssignedEdit] = useState(false);
  const [labelEdit, setLabelEdit] = useState(false);

  const [users, setUsers] = useState<any>();
  const [clients, setClients] = useState<any>();
  const [n, setN] = useState<any>();

  const [note, setNote] = useState<any>();
  const [issue, setIssue] = useState<any>();
  const [title, setTitle] = useState<any>();
  // const [uploaded, setUploaded] = useState<any>();
  const [priority, setPriority] = useState<any>();
  const [ticketStatus, setTicketStatus] = useState<any>();
  const [comment, setComment] = useState<any>();
  const [timeSpent, setTimeSpent] = useState<any>();
  const [publicComment, setPublicComment] = useState<any>(false);
  const [timeReason, setTimeReason] = useState("");

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [assignedClient, setAssignedClient] = useState<any>();
  const [ticketType, setTicketType] = useState<any>();
  const [ticketTypeOptions, setTicketTypeOptions] = useState<any[]>([]);
  const [ticketEmail, setTicketEmail] = useState<string>("");
  const [ticketName, setTicketName] = useState<string>("");
  const [ticketReplyTo, setTicketReplyTo] = useState<string>("");

  const history = useRouter();

  const { id } = history.query;

  async function update() {
    if (data && data.ticket && data.ticket.locked) return;

    const res = await fetch(`/api/v1/ticket/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id,
        detail: JSON.stringify(debouncedValue),
        note,
        title: debounceTitle,
        priority: priority?.value,
        status: ticketStatus?.value,
        type: ticketType?.value,
      }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: res.message || "Failed to update ticket",
      });
      return;
    }
    setEdit(false);
  }

  async function updateContactInfo() {
    if (data && data.ticket && data.ticket.locked) return;
    await fetch(`/api/v1/ticket/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id,
        email: ticketEmail,
        name: ticketName,
        replyTo: ticketReplyTo,
      }),
    });
  }

  async function updateStatus() {
    if (data && data.ticket && data.ticket.locked) return;

    const res = await fetch(`/api/v1/ticket/status/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: !data.ticket.isComplete,
        id,
      }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: res.message || "Failed to update status",
      });
      return;
    }
    refetch();
  }

  async function hide(hidden) {
    if (data && data.ticket && data.ticket.locked) return;

    const res = await fetch(`/api/v1/ticket/status/hide`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        hidden,
        id,
      }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: res.message || "Failed to update visibility",
      });
      return;
    }
    refetch();
  }

  async function lock(locked) {
    const res = await fetch(`/api/v1/ticket/status/lock`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        locked,
        id,
      }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: res.message || "Failed to update lock status",
      });
      return;
    }
    refetch();
  }

  async function deleteIssue() {
    await fetch(`/api/v1/ticket/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          toast({
            variant: "default",
            title: t("issue_deleted"),
            description: t("issue_deleted_desc"),
          });
          router.push("/issues");
        }
      });
  }

  async function addComment() {
    if (data && data.ticket && data.ticket.locked) return;

    const res = await fetch(`/api/v1/ticket/comment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: comment,
        id,
        public: publicComment,
      }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: res.message || "Failed to add comment",
      });
      return;
    }
    refetch();
  }

  async function deleteComment(id: string) {
    await fetch(`/api/v1/ticket/comment/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          refetch();
        } else {
          toast({
            variant: "destructive",
            title: t("error"),
            description: "Failed to delete comment",
          });
        }
      });
  }

  async function addTime() {
    if (data && data.ticket && data.ticket.locked) return;

    await fetch(`/api/v1/time/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        time: timeSpent,
        ticket: id,
        title: timeReason,
        user: user.id,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          setTimeEdit(false);
          setTimeSpent(undefined);
          setTimeReason("");
          refetch();
          toast({
            variant: "default",
            title: t("time_added"),
            description: t("time_added_desc"),
          });
        }
      });
  }

  function startTimer() {
    if (timerRunning) return;
    setTimerRunning(true);
    timerRef.current = setInterval(() => {
      setTimerSeconds((s: number) => s + 1);
    }, 1000);
  }

  function stopTimer() {
    if (!timerRunning) return;
    setTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function saveTimerAndReset() {
    if (timerSeconds < 60) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("timer_min_one_minute"),
      });
      return;
    }
    const minutes = Math.round(timerSeconds / 60);
    stopTimer();
    await fetch(`/api/v1/time/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        time: minutes,
        ticket: id,
        title: timeReason || t("timer_entry"),
        user: user.id,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          setTimerSeconds(0);
          setTimeReason("");
          refetch();
          toast({
            variant: "default",
            title: t("time_added"),
            description: `${minutes} ${t("minutes")}`,
          });
        }
      });
  }

  async function deleteTimeEntry(entryId: string) {
    await fetch(`/api/v1/time/${entryId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          refetch();
          toast({
            variant: "default",
            title: t("time_deleted"),
          });
        }
      });
  }

  function fmtTimer(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  async function fetchUsers() {
    const res = await fetch(`/api/v1/users/all`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: res.message || "Failed to fetch users",
      });
      return;
    }

    if (res.users) {
      setUsers(res.users);
    }
  }

  async function fetchClients() {
    const res = await fetch(`/api/v1/clients/all`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: res.message || "Failed to fetch clients",
      });
      return;
    }

    console.log(res);

    if (res.clients) {
      setClients(res.clients);
    }
  }

  async function fetchTicketTypes() {
    try {
      const res = await fetch(`/api/v1/ticket/ticket-types`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }).then((r) => r.json());

      if (res.success && Array.isArray(res.types)) {
        setTicketTypeOptions(
          res.types.map((t: string, idx: number) => ({
            id: String(idx),
            name: t.charAt(0).toUpperCase() + t.slice(1),
            value: t,
            icon: Tag,
          }))
        );
      }
    } catch (e) {
      console.error("Failed to fetch ticket types:", e);
    }
  }

  async function subscribe() {
    if (data && data.ticket && data.ticket.locked) return;

    const isFollowing = data.ticket.following?.includes(user.id);
    const action = isFollowing ? "unsubscribe" : "subscribe";

    const res = await fetch(`/api/v1/ticket/${action}/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: res.message || `Failed to ${action} to issue`,
      });
      return;
    }

    toast({
      title: isFollowing ? t("unsubscribed") : t("subscribed"),
      description: isFollowing
        ? t("will_not_receive_updates")
        : t("will_receive_updates"),
      duration: 3000,
    });

    refetch();
  }

  async function transferTicket() {
    if (data && data.ticket && data.ticket.locked) return;
    if (n === undefined) return;

    const res = await fetch(`/api/v1/ticket/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        user: n ? n.id : undefined,
        id,
      }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: res.message || "Failed to transfer ticket",
      });
      return;
    }

    setAssignedEdit(false);
    refetch();
  }

  async function transferClient() {
    if (data && data.ticket && data.ticket.locked) return;
    if (assignedClient === undefined) return;

    const res = await fetch(`/api/v1/ticket/transfer/client`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        client: assignedClient ? assignedClient.id : undefined,
        id,
      }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: res.message || "Failed to transfer client",
      });
      return;
    }

    setAssignedEdit(false);
    refetch();
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("user", user.id);

      try {
        const result = await fetch(
          `/api/v1/storage/ticket/${router.query.id}/upload/single`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        const data = await result.json();

        if (data.success) {
          refetch();
        }
      } catch (error) {
        console.error(error);
      } finally {
        setFile(null);
      }
    }
  };

  const fileInputRef = useRef(null);

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  useEffect(() => {
    handleUpload();
  }, [file]);

  useEffect(() => {
    fetchUsers();
    fetchClients();
    fetchTicketTypes();
  }, []);

  useEffect(() => {
    transferTicket();
  }, [n]);

  useEffect(() => {
    transferClient();
  }, [assignedClient]);

  const [debouncedValue] = useDebounce(issue, 500);
  const [debounceTitle] = useDebounce(title, 500);
  const [debounceEmail] = useDebounce(ticketEmail, 800);
  const [debounceName] = useDebounce(ticketName, 800);
  const [debounceReplyTo] = useDebounce(ticketReplyTo, 800);

  // Guard to prevent saving contact info before ticket data has loaded
  const contactInfoLoaded = useRef(false);
  const [contactInfoDirty, setContactInfoDirty] = useState(false);

  useEffect(() => {
    update();
  }, [priority, ticketStatus, ticketType, debounceTitle]);

  useEffect(() => {
    if (issue) {
      update();
    }
  }, [debouncedValue]);

  // Auto-save contact info only when user has changed a field (contactInfoDirty)
  useEffect(() => {
    if (contactInfoDirty) {
      updateContactInfo();
    }
  }, [debounceEmail, debounceName, debounceReplyTo]);

  async function loadFromStorage() {
    const storageString = data.ticket.detail as PartialBlock[];
    // if (storageString && isJsonString(storageString)) {
    //   return JSON.parse(storageString) as PartialBlock[]
    // } else {
    //   return undefined;
    // }
    try {
      // @ts-ignore
      return JSON.parse(storageString) as PartialBlock[];
    } catch (e) {
      return undefined;
    }
  }

  async function convertHTML() {
    const blocks = (await editor.tryParseHTMLToBlocks(
      data.ticket.detail
    )) as PartialBlock[];
    editor.replaceBlocks(editor.document, blocks);
  }

  // Loads the previously stored editor contents.
  useEffect(() => {
    if (status === "success" && data && data.ticket) {
      loadFromStorage().then((content) => {
        if (typeof content === "object") {
          setInitialContent(content);
        } else {
          setInitialContent(undefined);
        }
      });
      // Initialize editable contact fields from ticket data
      setTicketEmail(data.ticket.email || "");
      setTicketName(data.ticket.name || "");
      setTicketReplyTo(data.ticket.replyTo || "");
    }
  }, [status, data]);

  useEffect(() => {
    if (initialContent === undefined) {
      convertHTML();
    }
  }, [initialContent]);

  if (editor === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoaderCircle className="animate-spin" />
      </div>
    );
  }

  const handleInputChange = (editor) => {
    if (data.ticket.locked) return;
    setIssue(editor.document);
  };

  async function updateTicketStatus(e: any, ticket: any) {
    await fetch(`/api/v1/ticket/status/update`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: ticket.id, status: !ticket.isComplete }),
    })
      .then((res) => res.json())
      .then(() => {
        toast({
          title: ticket.isComplete ? t("issue_reopened") : t("issue_closed_toast"),
          description: t("status_updated_desc"),
          duration: 3000,
        });
        refetch();
      });
  }

  // Add these new functions
  async function updateTicketAssignee(ticketId: string, user: any) {
    try {
      const response = await fetch(`/api/v1/ticket/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user: user ? user.id : undefined,
          id: ticketId,
        }),
      });

      if (!response.ok) throw new Error("Failed to update assignee");

      toast({
        title: t("assignee_updated"),
        description: t("transferred_successfully"),
        duration: 3000,
      });
      refetch();
    } catch (error) {
      toast({
        title: t("error"),
        description: "Failed to update assignee",
        variant: "destructive",
        duration: 3000,
      });
    }
  }

  async function updateTicketPriority(ticket: any, priority: string) {
    try {
      const response = await fetch(`/api/v1/ticket/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: ticket.id,
          detail: ticket.detail,
          note: ticket.note,
          title: ticket.title,
          priority: priority,
          status: ticket.status,
        }),
      }).then((res) => res.json());

      if (!response.success) throw new Error("Failed to update priority");

      toast({
        title: t("change_priority"),
        description: `${t("priority")}: ${t(priority)}`,
        duration: 3000,
      });
      refetch();
    } catch (error) {
      toast({
        title: t("error"),
        description: "Failed to update priority",
        variant: "destructive",
        duration: 3000,
      });
    }
  }

  const priorities = ["low", "medium", "high"];

  return (
    <div>
      {status === "loading" && (
        <div className="min-h-screen flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
          <h2> {t("loading_data")} </h2>
          {/* <Spin /> */}
        </div>
      )}

      {status === "error" && (
        <div className="min-h-screen flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold"> {t("error_fetching_data")} </h2>
        </div>
      )}

      {status === "success" && (
        <ContextMenu>
          <ContextMenuTrigger>
            <main className="flex-1 min-h-[90vh] py-8">
              <div className="mx-auto max-w-7xl w-full px-4 flex flex-col lg:flex-row justify-center">
                <div className="lg:border-r lg:pr-8 lg:w-2/3">
                  <div className="md:flex md:justify-between md:space-x-4 lg:border-b lg:pb-4">
                    <div className="w-full">
                      <div className="flex flex-row space-x-1">
                        <h1 className="text-2xl mt-[5px] font-bold text-foreground">
                          #{data.ticket.Number} -
                        </h1>
                        <input
                          type="text"
                          name="title"
                          id="title"
                          style={{ fontSize: "1.5rem" }}
                          className="border-none -mt-[1px] px-0 pl-0.5 w-3/4 truncated m block text-foreground bg-transparent font-bold focus:outline-none focus:ring-0 placeholder:text-primary sm:text-sm sm:leading-6"
                          value={title}
                          defaultValue={data.ticket.title}
                          onChange={(e) => setTitle(e.target.value)}
                          key={data.ticket.id}
                          disabled={data.ticket.locked}
                        />
                      </div>
                      <div className="mt-2 text-xs flex flex-row justify-between items-center space-x-1">
                        <div className="flex flex-row space-x-1 items-center">
                          {data.ticket.client && (
                            <div>
                              <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                                {data.ticket.client.name}
                              </span>
                            </div>
                          )}
                          <div>
                            {!data.ticket.isComplete ? (
                              <div className="flex items-center space-x-2">
                                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                  {t("open_issue")}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                                  {t("closed_issue")}
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                              {t(data.ticket.type) || data.ticket.type}
                            </span>
                          </div>
                          {data.ticket.hidden && (
                            <div>
                              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                                {t("hidden")}
                              </span>
                            </div>
                          )}
                          {data.ticket.locked && (
                            <div>
                              <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                                {t("locked")}
                              </span>
                            </div>
                          )}
                        </div>
                        {user.isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center px-2 py-1 text-xs font-medium text-foreground ring-none outline-none ">
                              <Ellipsis className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="min-w-[160px]"
                            >
                              <DropdownMenuLabel>
                                <span>{t("issue_actions")}</span>
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {data.ticket.hidden ? (
                                <DropdownMenuItem
                                  className="flex flex-row space-x-3 items-center"
                                  onClick={() => hide(false)}
                                >
                                  <Eye className="h-4 w-4" />
                                  <span>{t("show_issue")}</span>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="flex flex-row space-x-3 items-center"
                                  onClick={() => hide(true)}
                                >
                                  <EyeOff className="h-4 w-4" />
                                  <span>{t("hide_issue")}</span>
                                </DropdownMenuItem>
                              )}
                              {data.ticket.locked ? (
                                <DropdownMenuItem
                                  className="flex flex-row space-x-3 items-center"
                                  onClick={() => lock(false)}
                                >
                                  <Unlock className="h-4 w-4" />
                                  <span>{t("unlock_issue")}</span>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="flex flex-row space-x-3 items-center"
                                  onClick={() => lock(true)}
                                >
                                  <Lock className="h-4 w-4" />
                                  <span>{t("lock_issue")}</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="flex flex-row space-x-3 items-center transition-colors duration-200 focus:bg-red-500 focus:text-white"
                                onClick={() => deleteIssue()}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="">{t("delete_issue")}</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </div>
                  <aside className="mt-4 lg:hidden">
                    <div className="border-b pb-1">
                      <div className="border-t pt-1">
                        <div className="flex flex-col sm:flex-row space-x-2">
                          <div className="ml-2">
                            {users && (
                              <UserCombo
                                value={users}
                                update={setN}
                                defaultName={
                                  data.ticket.assignedTo
                                    ? data.ticket.assignedTo.name
                                    : ""
                                }
                                disabled={data.ticket.locked}
                                placeholder={t("assign_user")}
                                hideInitial={false}
                                showIcon={true}
                              />
                            )}
                          </div>

                          <IconCombo
                            value={priorityOptions}
                            update={setPriority}
                            defaultName={
                              data.ticket.priority ? t(data.ticket.priority.toLowerCase()) : ""
                            }
                            disabled={data.ticket.locked}
                            hideInitial={false}
                          />

                          <IconCombo
                            value={ticketStatusMap}
                            update={setTicketStatus}
                            defaultName={
                              data.ticket.status ? t(data.ticket.status) : ""
                            }
                            disabled={data.ticket.locked}
                            hideInitial={false}
                          />

                          {ticketTypeOptions.length > 0 && (
                            <IconCombo
                              value={ticketTypeOptions}
                              update={setTicketType}
                              defaultName={
                                data.ticket.type ? data.ticket.type : ""
                              }
                              disabled={data.ticket.locked}
                              hideInitial={false}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </aside>
                  <div className="py-3 xl:pb-0 xl:pt-2 ">
                    <div className="prose max-w-none mt-2">
                      {!data.ticket.fromImap ? (
                        <>
                          <BlockNoteView
                            editor={editor}
                            sideMenu={false}
                            className="m-0 p-0 bg-transparent dark:text-white"
                            onChange={handleInputChange}
                            editable={!data.ticket.locked}
                          />
                        </>
                      ) : (
                        <div className="">
                          <div className="break-words bg-white rounded-md text-black">
                            <Frame
                              className="min-h-[60vh] h-full max-h-[80vh] overflow-y-auto w-full"
                              initialContent={data.ticket.detail}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <section
                    aria-labelledby="activity-title "
                    className="border-t mt-4"
                  >
                    <div className="p-2 flex flex-col space-y-1">
                      <div className="flex flex-row items-center justify-between">
                        <span
                          id="activity-title"
                          className="text-base font-medium "
                        >
                          {t("activity")}
                        </span>

                        <div className="flex flex-row items-center space-x-2">
                          <Button
                            variant={
                              data.ticket.following?.includes(user.id)
                                ? "ghost"
                                : "ghost"
                            }
                            onClick={() => subscribe()}
                            size="sm"
                            className="flex items-center gap-1 group"
                          >
                            {data.ticket.following?.includes(user.id) ? (
                              <>
                                <span className="text-xs group-hover:hidden">
                                  {t("following_status")}
                                </span>
                                <span className="text-xs hidden group-hover:inline text-destructive">
                                  {t("unsubscribe")}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs">{t("follow")}</span>
                            )}
                          </Button>

                          {data.ticket.following &&
                            data.ticket.following.length > 0 && (
                              <div className="flex space-x-2">
                                <Popover>
                                  <PopoverTrigger>
                                    <PanelTopClose className="h-4 w-4" />
                                  </PopoverTrigger>
                                  <PopoverContent>
                                    <div className="flex flex-col space-y-1">
                                      <span className="text-xs">{t("followers")}</span>
                                      {data.ticket.following.map(
                                        (follower: any) => {
                                          const userMatch = users.find(
                                            (user) =>
                                              user.id === follower &&
                                              user.id !==
                                                data.ticket.assignedTo.id
                                          );
                                          console.log(userMatch);
                                          return userMatch ? (
                                            <div key={follower.id}>
                                              <span>{userMatch.name}</span>
                                            </div>
                                          ) : null;
                                        }
                                      )}

                                      {data.ticket.following.filter(
                                        (follower: any) =>
                                          follower !== data.ticket.assignedTo.id
                                      ).length === 0 && (
                                        <span className="text-xs">
                                          {t("no_followers")}
                                        </span>
                                      )}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            )}
                        </div>
                      </div>
                      <div>
                        <div className="flex flex-row items-center text-sm space-x-1 flex-wrap">
                          {data.ticket.fromImap ? (
                            <>
                              {data.ticket.createdBy ? (
                                <>
                                  <span className="font-bold">
                                    {data.ticket.createdBy.name}
                                  </span>
                                  {data.ticket.createdBy.role && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                      data.ticket.createdBy.role === "external" 
                                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                        : data.ticket.createdBy.role === "admin"
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                        : data.ticket.createdBy.role === "manager"
                                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                        : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    }`}>
                                      {data.ticket.createdBy.role === "external" ? t("external_role") 
                                        : data.ticket.createdBy.role === "admin" ? "Admin"
                                        : data.ticket.createdBy.role === "manager" ? "Manager"
                                        : t("internal_role")}
                                    </span>
                                  )}
                                  <span>{t("created_via_email")}</span>
                                  {data.ticket.email && data.ticket.email !== data.ticket.createdBy.email && (
                                    <span>
                                      ( <strong>{data.ticket.email}</strong> )
                                    </span>
                                  )}
                                  {!data.ticket.email || data.ticket.email === data.ticket.createdBy.email ? (
                                    <span>
                                      ( <strong>{data.ticket.createdBy.email}</strong> )
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  <span className="font-bold">
                                    {data.ticket.name || data.ticket.email}
                                  </span>
                                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                    {t("unknown_role")}
                                  </span>
                                  <span>{t("created_via_email")}</span>
                                  {data.ticket.name && data.ticket.email && (
                                    <span>
                                      ( <strong>{data.ticket.email}</strong> )
                                    </span>
                                  )}
                                </>
                              )}
                              <span>{t("on_date")}</span>
                              <span className="font-bold">
                                {moment(data.ticket.createdAt).format(
                                  "DD/MM/YYYY"
                                )}
                              </span>
                              {data.ticket.client && (
                                <span>
                                  — {t("customer_label")}:{" "}
                                  <strong>{data.ticket.client.name}</strong>
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              {data.ticket.createdBy ? (
                                <div className="flex flex-row space-x-1">
                                  <span>
                                    {t("created_by")}
                                    <strong className="ml-1">
                                      {data.ticket.createdBy.name}
                                    </strong>{" "}
                                    {t("at_time")}{" "}
                                  </span>
                                  <span className="">
                                    {moment(data.ticket.createdAt).format(
                                      "LLL"
                                    )}
                                  </span>
                                  {data.ticket.name && (
                                    <span>
                                      {t("for_person")} <strong>{data.ticket.name}</strong>
                                    </span>
                                  )}
                                  {data.ticket.email && (
                                    <span>
                                      ( <strong>{data.ticket.email}</strong> )
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-row space-x-1">
                                  <span>{t("created_at")} </span>
                                  <span className="">
                                    <strong>
                                      {moment(data.ticket.createdAt).format(
                                        "LLL"
                                      )}
                                    </strong>
                                    {data.ticket.client && (
                                      <span>
                                        {t("for_person")}{" "}
                                        <strong>
                                          {data.ticket.client.name}
                                        </strong>
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="">
                        <ul role="list" className="space-y-2">
                          {data.ticket.comments.length > 0 &&
                            data.ticket.comments.map((comment: any) => (
                              <li
                                key={comment.id}
                                className="group flex flex-col space-y-1 text-sm bg-secondary/50 dark:bg-secondary/50 px-4 py-2 rounded-lg relative"
                              >
                                <div className="flex flex-row space-x-2 items-center">
                                  <Avatar className="w-6 h-6">
                                    <AvatarImage
                                      src={
                                        comment.user ? comment.user.image : ""
                                      }
                                    />
                                    <AvatarFallback>
                                      {comment.user
                                        ? comment.user.name.slice(0, 1)
                                        : comment.replyEmail.slice(0, 1)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-bold">
                                    {comment.user
                                      ? comment.user.name
                                      : comment.replyEmail}
                                  </span>
                                  <span className="text-xs lowercase">
                                    {moment(comment.createdAt).format("LLL")}
                                  </span>
                                  {(user.isAdmin ||
                                    (comment.user &&
                                      comment.userId === user.id)) && (
                                    <Trash2
                                      className="h-4 w-4 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-muted-foreground hover:text-destructive"
                                      onClick={() => {
                                        deleteComment(comment.id);
                                      }}
                                    />
                                  )}
                                </div>
                                <span className="ml-1">{comment.text}</span>
                              </li>
                            ))}
                        </ul>
                      </div>
                      <div className="mt-6">
                        <div className="flex space-x-3">
                          <div className="min-w-0 flex-1">
                            <div>
                              <div>
                                <label htmlFor="comment" className="sr-only">
                                  {t("comment")}
                                </label>
                                <textarea
                                  id="comment"
                                  name="comment"
                                  rows={3}
                                  className="block w-full bg-secondary/50 dark:bg-secondary/50 rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-background focus:ring-0 focus:ring-inset focus:ring-gray-900 sm:text-sm sm:leading-6"
                                  placeholder={
                                    data.ticket.locked
                                      ? t("ticket_locked")
                                      : t("leave_a_comment")
                                  }
                                  defaultValue={""}
                                  onChange={(e) => setComment(e.target.value)}
                                  disabled={data.ticket.locked}
                                />
                              </div>
                              <div className="mt-4 flex justify-end">
                                <div>
                                  <div className="flex flex-row items-center space-x-2">
                                    <Switch
                                      checked={publicComment}
                                      onCheckedChange={setPublicComment}
                                    />
                                    <span> {t("public_reply")}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4 flex items-center justify-end space-x-4">
                                {data.ticket.isComplete ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!data.ticket.locked) {
                                        updateStatus();
                                      }
                                    }}
                                    disabled={data.ticket.locked}
                                    className={`inline-flex justify-center items-center gap-x-1.5 rounded-md ${
                                      data.ticket.locked
                                        ? "bg-gray-300 cursor-not-allowed"
                                        : "bg-white hover:bg-gray-50"
                                    } px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300`}
                                  >
                                    <CheckCircleIcon
                                      className="-ml-0.5 h-5 w-5 text-red-500"
                                      aria-hidden="true"
                                    />
                                    <span className="">
                                      {t("reopen_issue")}
                                    </span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!data.ticket.locked) {
                                        updateStatus();
                                      }
                                    }}
                                    disabled={data.ticket.locked}
                                    className={`inline-flex justify-center gap-x-1.5 rounded-md ${
                                      data.ticket.locked
                                        ? "bg-gray-300 cursor-not-allowed"
                                        : "bg-white hover:bg-gray-50"
                                    } px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300`}
                                  >
                                    <CheckCircleIcon
                                      className="-ml-0.5 h-5 w-5 text-green-500"
                                      aria-hidden="true"
                                    />
                                    {t("close_issue")}
                                  </button>
                                )}
                                <button
                                  onClick={() => addComment()}
                                  type="submit"
                                  disabled={data.ticket.locked}
                                  className={`inline-flex items-center justify-center rounded-md px-4 py-1.5 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 ${
                                    data.ticket.locked
                                      ? "bg-gray-400 cursor-not-allowed"
                                      : "bg-gray-900 hover:bg-gray-700"
                                  }`}
                                >
                                  {t("comment")}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
                <div className="hidden lg:block lg:pl-8 lg:order-2 order-1">
                  <h2 className="sr-only">{t("details")}</h2>
                  <div className="space-y-1 py-2">
                    {users && (
                      <UserCombo
                        value={users}
                        update={setN}
                        defaultName={
                          data.ticket.assignedTo
                            ? data.ticket.assignedTo.name
                            : ""
                        }
                        disabled={data.ticket.locked}
                        showIcon={true}
                        placeholder={t("change_user")}
                        hideInitial={false}
                      />
                    )}
                    <IconCombo
                      value={priorityOptions}
                      update={setPriority}
                      defaultName={
                        data.ticket.priority ? t(data.ticket.priority.toLowerCase()) : ""
                      }
                      disabled={data.ticket.locked}
                      hideInitial={false}
                    />
                    <IconCombo
                      value={ticketStatusMap}
                      update={setTicketStatus}
                      defaultName={data.ticket.status ? t(data.ticket.status) : ""}
                      disabled={data.ticket.locked}
                      hideInitial={false}
                    />
                    {ticketTypeOptions.length > 0 && (
                      <IconCombo
                        value={ticketTypeOptions}
                        update={setTicketType}
                        defaultName={
                          data.ticket.type ? data.ticket.type : ""
                        }
                        disabled={data.ticket.locked}
                        hideInitial={false}
                      />
                    )}
                    {clients && (
                      <ClientCombo
                        value={clients}
                        update={setAssignedClient}
                        defaultName={
                          data.ticket.client
                            ? data.ticket.client.name
                            : t("no_client_assigned")
                        }
                        disabled={data.ticket.locked}
                        showIcon={true}
                        hideInitial={false}
                      />
                    )}

                    {/* Editable contact / notification recipient — admin and manager only */}
                    {(user?.isAdmin || user?.isManager) && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-1">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {t("notification_label")}
                      </span>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{t("name")}</span>
                          <input
                            type="text"
                            value={ticketName}
                            disabled={data.ticket.locked}
                            onChange={(e) => { setTicketName(e.target.value); setContactInfoDirty(true); }}
                            placeholder={t("contact_name_placeholder")}
                            className="w-full text-sm bg-transparent border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:text-white py-0.5 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{t("email_recipient")}</span>
                          <input
                            type="email"
                            value={ticketEmail}
                            disabled={data.ticket.locked}
                            onChange={(e) => { setTicketEmail(e.target.value); setContactInfoDirty(true); }}
                            placeholder={t("contact_email_placeholder")}
                            className="w-full text-sm bg-transparent border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:text-white py-0.5 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{t("additional_recipient")}</span>
                          <input
                            type="email"
                            value={ticketReplyTo}
                            disabled={data.ticket.locked}
                            onChange={(e) => { setTicketReplyTo(e.target.value); setContactInfoDirty(true); }}
                            placeholder={t("reply_to_placeholder")}
                            className="w-full text-sm bg-transparent border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:text-white py-0.5 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{t("due_date")}</span>
                          <input
                            type="date"
                            value={data.ticket.dueDate ? moment(data.ticket.dueDate).format("YYYY-MM-DD") : ""}
                            disabled={data.ticket.locked}
                            onChange={async (e) => {
                              const newDueDate = e.target.value;
                              await fetch(`/api/v1/ticket/update`, {
                                method: "PUT",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                  id,
                                  dueDate: newDueDate,
                                }),
                              });
                              refetch();
                            }}
                            className="w-full text-sm bg-transparent border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:text-white py-0.5 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>
                    )}

                    {(user.isAdmin || user.isManager) && (
                    <div className="border-t border-gray-200 dark:border-gray-700">
                      <div className="flex flex-row items-center justify-between mt-2">
                        <span className="text-sm font-medium text-gray-500 dark:text-white flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {t("time_tracking")}
                        </span>
                        {!editTime ? (
                          <button
                            onClick={() => setTimeEdit(true)}
                            className="text-sm font-medium text-gray-500 hover:underline dark:text-white"
                          >
                            {t("add")}
                          </button>
                        ) : (
                          <button
                            onClick={() => setTimeEdit(false)}
                            className="text-sm font-medium text-gray-500 hover:underline dark:text-white"
                          >
                            {t("close")}
                          </button>
                        )}
                      </div>

                      {/* Timer */}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="font-mono text-lg dark:text-white tabular-nums">
                          {fmtTimer(timerSeconds)}
                        </span>
                        {!timerRunning ? (
                          <button
                            onClick={startTimer}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title={t("timer_start")}
                          >
                            <Play className="h-4 w-4 text-green-600" />
                          </button>
                        ) : (
                          <button
                            onClick={stopTimer}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title={t("timer_stop")}
                          >
                            <Pause className="h-4 w-4 text-red-500" />
                          </button>
                        )}
                        {timerSeconds > 0 && !timerRunning && (
                          <button
                            onClick={saveTimerAndReset}
                            className="text-xs font-medium text-blue-600 hover:underline"
                          >
                            {t("timer_save")}
                          </button>
                        )}
                      </div>

                      {/* Timer description input (shown when timer has run) */}
                      {(timerRunning || timerSeconds > 0) && (
                        <input
                          type="text"
                          className="mt-1 w-full text-sm bg-transparent border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:text-white py-0.5"
                          placeholder={t("what_did_you_do")}
                          value={timeReason}
                          onChange={(e) => setTimeReason(e.target.value)}
                        />
                      )}

                      {/* Manual entry form */}
                      {editTime && (
                        <div className="mt-2 flex flex-col space-y-2">
                          <input
                            type="text"
                            className="w-full text-sm bg-transparent border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:text-white py-0.5"
                            placeholder={t("what_did_you_do")}
                            value={timeReason}
                            onChange={(e) => setTimeReason(e.target.value)}
                          />
                          <input
                            type="number"
                            className="w-full text-sm bg-transparent border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-400 dark:text-white py-0.5"
                            placeholder={t("time_in_minutes")}
                            value={timeSpent || ""}
                            onChange={(e) => setTimeSpent(e.target.value)}
                          />
                          <button
                            onClick={() => addTime()}
                            className="self-end text-xs font-medium text-blue-600 hover:underline"
                          >
                            {t("save")}
                          </button>
                        </div>
                      )}

                      {/* Existing entries */}
                      <div className="mt-2 space-y-1">
                        {data && data.ticket && data.ticket.TimeTracking && data.ticket.TimeTracking.length > 0 ? (
                          data.ticket.TimeTracking.map((i: any) => (
                            <div key={i.id} className="flex items-center justify-between text-xs dark:text-white group">
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">{i.user?.name}</span>
                                <span>·</span>
                                <span className="font-medium">{i.time} {t("minutes")}</span>
                                {i.title && (
                                  <>
                                    <span>·</span>
                                    <span className="text-muted-foreground">{i.title}</span>
                                  </>
                                )}
                              </div>
                              <button
                                onClick={() => deleteTimeEntry(i.id)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 transition-opacity"
                                title={t("delete")}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t("no_time_added")}
                          </span>
                        )}
                      </div>

                      {/* Total time */}
                      {data && data.ticket && data.ticket.TimeTracking && data.ticket.TimeTracking.length > 0 && (
                        <div className="mt-1 pt-1 border-t border-gray-100 dark:border-gray-700 text-xs font-medium dark:text-white">
                          {t("total")}: {data.ticket.TimeTracking.reduce((sum: number, i: any) => sum + i.time, 0)} {t("minutes")}
                        </div>
                      )}
                    </div>
                    )}

                    <div className="border-t border-gray-200">
                      <div className="flex flex-row items-center justify-between mt-2">
                        <span className="text-sm font-medium text-gray-500 dark:text-white flex items-center gap-1">
                          <Paperclip className="h-4 w-4" />
                          {t("attachments")}
                        </span>
                        <button
                          className="text-sm font-medium text-gray-500 hover:underline dark:text-white"
                          onClick={handleButtonClick}
                        >
                          {t("upload")}
                          <input
                            id="file"
                            type="file"
                            hidden
                            ref={fileInputRef}
                            onChange={handleFileChange}
                          />
                        </button>
                      </div>

                      <div className="mt-1 space-y-1">
                        {data.ticket.files && data.ticket.files.length > 0 ? (
                          data.ticket.files.map((f: any) => (
                            <div
                              key={f.id}
                              className="flex items-center justify-between p-1 px-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 group"
                            >
                              <span className="text-xs truncate max-w-[140px] dark:text-white">
                                {f.filename}
                              </span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(
                                        `/api/v1/ticket/${id}/file/${f.id}/download`,
                                        { headers: { Authorization: `Bearer ${token}` } }
                                      );
                                      if (!res.ok) return;
                                      const blob = await res.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = f.filename;
                                      a.click();
                                      window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                      console.error("Download error:", err);
                                    }
                                  }}
                                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                  title="Download"
                                >
                                  <Download className="h-3.5 w-3.5 text-gray-500" />
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(
                                        `/api/v1/ticket/${id}/file/${f.id}/delete`,
                                        {
                                          method: "DELETE",
                                          headers: {
                                            Authorization: `Bearer ${token}`,
                                          },
                                        }
                                      );
                                      const result = await res.json();
                                      if (result.success) {
                                        refetch();
                                      } else {
                                        toast({
                                          variant: "destructive",
                                          title: t("error"),
                                          description:
                                            result.message ||
                                            "Failed to delete file",
                                        });
                                      }
                                    } catch (err) {
                                      console.error("Delete file error:", err);
                                    }
                                  }}
                                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {t("no_files_attached")}
                          </span>
                        )}
                        {file && (
                          <div className="p-1 px-1.5">
                            <span className="text-xs text-blue-500">
                              {t("uploading_file")} {file.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            <ContextMenuItem
              onClick={(e) => updateTicketStatus(e, data.ticket)}
            >
              {data.ticket.isComplete ? t("reopen_issue_action") : t("close_issue")}
            </ContextMenuItem>
            <ContextMenuSeparator />

            <ContextMenuSub>
              <ContextMenuSubTrigger>{t("assign_to")}</ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-64 ml-1 -mt-1/2">
                <Command>
                  <CommandList>
                    <CommandGroup heading={t("assign_to")}>
                      <CommandItem
                        onSelect={() =>
                          updateTicketAssignee(data.ticket.id, undefined)
                        }
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            data.ticket.assignedTo === null
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <CheckIcon className={cn("h-4 w-4")} />
                        </div>
                        <span>{t("unassigned")}</span>
                      </CommandItem>
                      {users?.map((user) => (
                        <CommandItem
                          key={user.id}
                          onSelect={() =>
                            updateTicketAssignee(data.ticket.id, user)
                          }
                        >
                          <div
                            className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                              data.ticket.assignedTo?.name === user.name
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50 [&_svg]:invisible"
                            )}
                          >
                            <CheckIcon className={cn("h-4 w-4")} />
                          </div>
                          <span>{user.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSub>
              <ContextMenuSubTrigger>{t("change_priority")}</ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-64 ml-1">
                <Command>
                  <CommandList>
                    <CommandGroup heading={t("priority")}>
                      {priorities.map((priority) => (
                        <CommandItem
                          key={priority}
                          onSelect={() =>
                            updateTicketPriority(data.ticket, priority)
                          }
                        >
                          <div
                            className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                              data.ticket.priority.toLowerCase() === priority
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50 [&_svg]:invisible"
                            )}
                          >
                            <CheckIcon className={cn("h-4 w-4")} />
                          </div>
                          <span className="capitalize">{t(priority)}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSeparator />

            <ContextMenuItem
              onClick={(e) => {
                e.preventDefault();
                toast({
                  title: t("link_copied"),
                  description: t("link_copied_desc"),
                  duration: 3000,
                });
                navigator.clipboard.writeText(
                  `${window.location.origin}/issue/${data.ticket.id}`
                );
              }}
            >
              {t("share_link")}
            </ContextMenuItem>

            <ContextMenuSeparator />

            {user.isAdmin && (
              <ContextMenuItem
                className="text-red-600"
                onClick={(e) => deleteIssue()}
              >
                {t("delete_ticket")}
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>
      )}
    </div>
  );
}
