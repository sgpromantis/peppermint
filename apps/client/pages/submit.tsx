// Check if the ID matches the id of the company
// If true then show ticket creation htmlForm else show access denied htmlForm
// API post request to creating a ticket with relevant client info
// Default to unassigned engineer
// Send Email to customer with ticket creation
// Send Email to Engineers with ticket creation if email notifications are turned on

import { toast } from "@/shadcn/hooks/use-toast";
import { Listbox, Transition } from "@headlessui/react";
import {
  CheckCircleIcon,
  CheckIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/20/solid";
import { useRouter } from "next/router";
import { Fragment, useEffect, useState } from "react";
import { useUser } from "../store/session";

const defaultTypes = [
  { id: 5, name: "Vorfall" },
  { id: 1, name: "Service" },
  { id: 2, name: "Feature" },
  { id: 3, name: "Fehler" },
  { id: 4, name: "Wartung" },
  { id: 6, name: "Zugriff" },
  { id: 8, name: "Feedback" },
];

const pri = [
  { id: 7, name: "Niedrig" },
  { id: 8, name: "Mittel" },
  { id: 9, name: "Hoch" },
];

export default function ClientTicketNew() {
  function classNames(...classes) {
    return classes.filter(Boolean).join(" ");
  }

  // Require authentication — useUser auto-redirects to /auth/login if no session
  const { user, loading } = useUser();

  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState("new");
  const [ticketID, setTicketID] = useState("");

  const [typeOptions, setTypeOptions] = useState<any[]>(defaultTypes);
  const [selected, setSelected] = useState(defaultTypes[2]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(pri[0]);

  useEffect(() => {
    // Fetch custom ticket types (public endpoint)
    fetch(`/api/v1/ticket/ticket-types`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.types) && res.types.length > 0) {
          const opts = res.types.map((t: string, idx: number) => ({
            id: idx,
            name: t.charAt(0).toUpperCase() + t.slice(1),
          }));
          setTypeOptions(opts);
          const supportOpt = opts.find((o: any) => o.name.toLowerCase() === "support");
          setSelected(supportOpt || opts[0]);
        }
      })
      .catch(() => {});
  }, []);

  async function submitTicket() {
    setIsLoading(true);
    await fetch(`/api/v1/ticket/public/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name,
        title: subject,
        company: router.query.id,
        email,
        detail: description,
        priority: priority.name,
        type: selected.name,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success === true) {
          toast({
            variant: "default",
            title: "Erfolg",
            description: "Ticket erfolgreich erstellt",
          });

          setView("success");
          setTicketID(res.id);
        } else {
          toast({
            variant: "destructive",
            title: "Fehler",
            description: res.message || `Bitte füllen Sie alle Felder aus und versuchen Sie es erneut`,
          });
        }
      });
    setIsLoading(false);
  }

  // Don't render until we have confirmed the user is authenticated
  if (loading || !user) return null;

  return (
    <div className="flex justify-center items-center content-center h-screen bg-gray-900">
      {view === "new" ? (
        <div className="max-w-2xl bg-white p-12 rounded-md">
          <h1 className="font-bold text-2xl">Ticket einreichen</h1>
          <span>
            Benötigen Sie Hilfe? Reichen Sie ein Ticket ein und unser Support-Team
            wird sich so schnell wie möglich bei Ihnen melden.
          </span>

          <div className="my-4 flex flex-col space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Name
              </label>
              <div className="mt-2">
                <input
                  type="email"
                  name="email"
                  id="email"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                  placeholder="John Doe"
                  onChange={(e) => setName(e.target.value)}
                  value={name}
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Email
              </label>
              <div className="mt-2">
                <input
                  type="email"
                  name="email"
                  id="email"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                  placeholder="johnD@meta.com"
                  onChange={(e) => setEmail(e.target.value)}
                  value={email}
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Betreff
              </label>
              <div className="mt-2">
                <input
                  type="email"
                  name="email"
                  id="email"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                  placeholder="Ich kann mich nicht einloggen"
                  onChange={(e) => setSubject(e.target.value)}
                  value={subject}
                />
              </div>
            </div>

            <Listbox value={selected} onChange={setSelected}>
              {({ open }) => (
                <>
                  <Listbox.Label className="block text-sm font-medium leading-6 text-gray-900">
                    Ticket-Typ
                  </Listbox.Label>
                  <div className="relative mt-2">
                    <Listbox.Button className="relative w-full cursor-default rounded-md bg-white py-1.5 pl-3 pr-10 text-left text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none sm:text-sm sm:leading-6">
                      <span className="block truncate">{selected.name}</span>
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronUpDownIcon
                          className="h-5 w-5 text-gray-400"
                          aria-hidden="true"
                        />
                      </span>
                    </Listbox.Button>

                    <Transition
                      show={open}
                      as={Fragment}
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {typeOptions.map((person) => (
                          <Listbox.Option
                            key={person.id}
                            className={({ active }) =>
                              classNames(
                                active
                                  ? "bg-gray-400 text-white"
                                  : "text-gray-900",
                                "relative cursor-default select-none py-2 pl-3 pr-9"
                              )
                            }
                            value={person}
                          >
                            {({ selected, active }) => (
                              <>
                                <span
                                  className={classNames(
                                    selected ? "font-semibold" : "font-normal",
                                    "block truncate"
                                  )}
                                >
                                  {person.name}
                                </span>

                                {selected ? (
                                  <span
                                    className={classNames(
                                      active ? "text-white" : "text-indigo-600",
                                      "absolute inset-y-0 right-0 flex items-center pr-4"
                                    )}
                                  >
                                    <CheckIcon
                                      className="h-5 w-5"
                                      aria-hidden="true"
                                    />
                                  </span>
                                ) : null}
                              </>
                            )}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </>
              )}
            </Listbox>

            <Listbox value={priority} onChange={setPriority}>
              {({ open }) => (
                <>
                  <Listbox.Label className="block text-sm font-medium leading-6 text-gray-900">
                    Priorität
                  </Listbox.Label>
                  <div className="relative mt-2">
                    <Listbox.Button className="relative w-full cursor-default rounded-md bg-white py-1.5 pl-3 pr-10 text-left text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none sm:text-sm sm:leading-6">
                      <span className="block truncate">{priority.name}</span>
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronUpDownIcon
                          className="h-5 w-5 text-gray-400"
                          aria-hidden="true"
                        />
                      </span>
                    </Listbox.Button>

                    <Transition
                      show={open}
                      as={Fragment}
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {pri.map((person) => (
                          <Listbox.Option
                            key={person.id}
                            className={({ active }) =>
                              classNames(
                                active
                                  ? "bg-gray-400 text-white"
                                  : "text-gray-900",
                                "relative cursor-default select-none py-2 pl-3 pr-9"
                              )
                            }
                            value={person}
                          >
                            {({ selected, active }) => (
                              <>
                                <span
                                  className={classNames(
                                    selected ? "font-semibold" : "font-normal",
                                    "block truncate"
                                  )}
                                >
                                  {person.name}
                                </span>

                                {selected ? (
                                  <span
                                    className={classNames(
                                      active ? "text-white" : "text-indigo-600",
                                      "absolute inset-y-0 right-0 flex items-center pr-4"
                                    )}
                                  >
                                    <CheckIcon
                                      className="h-5 w-5"
                                      aria-hidden="true"
                                    />
                                  </span>
                                ) : null}
                              </>
                            )}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </>
              )}
            </Listbox>

            <div>
              <label
                htmlFor="comment"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Beschreibung des Problems
              </label>
              <div className="mt-2">
                <textarea
                  rows={4}
                  name="comment"
                  id="comment"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  defaultValue={""}
                  placeholder="Ich glaube, ich habe mich ausgesperrt!"
                  onChange={(e) => setDescription(e.target.value)}
                  value={description}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={submitTicket}
              disabled={isLoading}
              className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 "
            >
              Ticket einreichen
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-md bg-green-600 shadow-md p-12">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircleIcon
                  className="h-10 w-10 text-white"
                  aria-hidden="true"
                />
              </div>
              <div className="ml-3">
                <h3 className="text-4xl font-medium text-white">
                  Ticket eingereicht
                </h3>
                <div className="mt-2 text-sm text-white">
                  <p>
                    Ein Mitglied unseres Teams wurde benachrichtigt und wird sich
                    in Kürze bei Ihnen melden.
                  </p>
                </div>
                {/* <div className="mt-4">
                  <div className="-mx-2 -my-1.5 flex">
                    <Link
                      href={`/portal/${router.query.id}/ticket/${ticketID}`}
                      className="rounded-md bg-green-50 px-2 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 focus:ring-offset-green-50"
                    >
                      View status
                    </Link>
                  </div>
                </div> */}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
