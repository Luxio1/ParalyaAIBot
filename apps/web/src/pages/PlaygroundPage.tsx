import {
  PLAYGROUND_IMAGE_MAX_BYTES,
  PLAYGROUND_IMAGE_TYPES,
  PLAYGROUND_MAX_IMAGES,
  playgroundResponseSchema,
  type EventTestResult,
} from '@bot/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, ImagePlus, RotateCcw, Send, Radar, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { DiscordMarkdown } from '@/components/DiscordMarkdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useRealtime } from '@/hooks/useRealtime';
import { apiPost, apiSend, commandsQuery, configQuery } from '@/lib/api';

interface PendingImage {
  mimeType: (typeof PLAYGROUND_IMAGE_TYPES)[number];
  /** Contenu en base64, sans le préfixe `data:`. */
  data: string;
  previewUrl: string;
}

type ChatItem =
  | { id: number; kind: 'user'; time: string; author: string; text: string; images: string[] }
  | { id: number; kind: 'bot'; time: string; text: string }
  | { id: number; kind: 'event'; result: EventTestResult }
  | { id: number; kind: 'notice'; text: string };

const timeFormat = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' });
let nextId = 1;
const now = () => timeFormat.format(new Date());

export function PlaygroundPage() {
  const bot = useRealtime().bot;
  const prefix = useQuery(configQuery).data?.prefix ?? '!';
  const commands = (useQuery(commandsQuery).data ?? []).filter((command) => command.enabled);
  const [authorName, setAuthorName] = useState('Testeur');
  const [evaluateEvents, setEvaluateEvents] = useState(true);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [text, setText] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const append = (...added: ChatItem[]) => setItems((current) => [...current, ...added]);

  const send = useMutation({
    mutationFn: (body: { text: string; images: PendingImage[] }) =>
      apiPost(
        '/api/playground/messages',
        {
          text: body.text,
          authorName,
          images: body.images.map(({ mimeType, data }) => ({ mimeType, data })),
          evaluateEvents,
        },
        playgroundResponseSchema,
      ),
    onSuccess: (response) => {
      append(
        ...response.events.map((result): ChatItem => ({ id: nextId++, kind: 'event', result })),
        ...response.replies.map((reply): ChatItem => ({
          id: nextId++,
          kind: 'bot',
          time: now(),
          text: reply,
        })),
      );
      if (response.eventsError) {
        append({
          id: nextId++,
          kind: 'notice',
          text: `Analyse des événements impossible : ${response.eventsError}`,
        });
      }
      if (response.replies.length === 0) {
        append({ id: nextId++, kind: 'notice', text: "Le bot n'a pas répondu : voir la console." });
      }
    },
    onError: (error) => append({ id: nextId++, kind: 'notice', text: error.message }),
  });

  const reset = useMutation({
    mutationFn: () => apiSend('POST', '/api/playground/reset', { authorName }),
    onSuccess: () => {
      setItems([]);
      toast.success(`Mémoire du simulateur effacée pour « ${authorName} ».`);
    },
    onError: (error) => toast.error(error.message),
  });

  useLayoutEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [items.length, send.isPending]);

  const submit = () => {
    if ((!text.trim() && images.length === 0) || send.isPending || !authorName.trim()) return;
    append({
      id: nextId++,
      kind: 'user',
      time: now(),
      author: authorName,
      text,
      images: images.map((image) => image.previewUrl),
    });
    send.mutate({ text, images });
    setText('');
    setImages([]);
  };

  const addFiles = async (files: Iterable<File>) => {
    for (const file of files) {
      if (images.length >= PLAYGROUND_MAX_IMAGES) {
        toast.error(`${PLAYGROUND_MAX_IMAGES} images maximum.`);
        return;
      }
      try {
        const image = await readImage(file);
        setImages((current) => [...current, image].slice(0, PLAYGROUND_MAX_IMAGES));
      } catch (error) {
        toast.error((error as Error).message);
      }
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...event.clipboardData.files].filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;
    event.preventDefault();
    void addFiles(files);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const insertCommand = (name: string) => {
    setText(`${prefix}${name} `);
    inputRef.current?.focus();
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-3">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">Simulateur</h1>
        <div className="flex items-center gap-2">
          <Label htmlFor="author">Pseudo</Label>
          <Input
            id="author"
            className="h-8 w-36"
            maxLength={32}
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="evaluateEvents"
            checked={evaluateEvents}
            onCheckedChange={setEvaluateEvents}
          />
          <Label htmlFor="evaluateEvents">Événements</Label>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={reset.isPending || !authorName.trim()}
          onClick={() => reset.mutate()}
        >
          <RotateCcw />
          Réinitialiser la mémoire
        </Button>
      </header>
      <p className="text-muted-foreground text-xs">
        Même moteur que sur Discord (persona, commandes, mémoire, images, liens), sans limitation de
        fréquence. Les règles d'événements sont analysées sans qu'aucune action ne soit envoyée.
      </p>

      {commands.length > 0 && (
        <div className="flex flex-wrap gap-1" aria-label="Commandes actives">
          {commands.map((command) => (
            <Button
              key={command.id}
              variant="secondary"
              size="sm"
              className="h-7 font-mono text-xs"
              title={command.description}
              onClick={() => insertCommand(command.name)}
            >
              {prefix}
              {command.name}
            </Button>
          ))}
        </div>
      )}

      <div
        ref={listRef}
        className="bg-card min-h-64 flex-1 overflow-y-auto rounded-lg border p-4"
        aria-live="polite"
      >
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Écrivez un message comme sur Discord : le bot répond à tout, sans mention.
          </p>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => (
              <ChatRow
                key={item.id}
                item={item}
                botName={bot?.user?.tag ?? 'Bot'}
                botAvatar={bot?.user?.avatarUrl}
              />
            ))}
            {send.isPending && (
              <p className="text-muted-foreground animate-pulse text-sm">
                {bot?.user?.tag ?? 'Le bot'} est en train d'écrire...
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        {images.length > 0 && (
          <div className="flex gap-2">
            {images.map((image, index) => (
              <div key={image.previewUrl} className="relative">
                <img
                  src={image.previewUrl}
                  alt=""
                  className="size-16 rounded-md border object-cover"
                />
                <button
                  type="button"
                  aria-label="Retirer l'image"
                  className="bg-background absolute -top-2 -right-2 rounded-full border p-0.5"
                  onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Ajouter une image"
            title="Ajouter une image (ou Ctrl+V)"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus />
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept={PLAYGROUND_IMAGE_TYPES.join(',')}
            multiple
            hidden
            onChange={(event) => {
              void addFiles(event.target.files ?? []);
              event.target.value = '';
            }}
          />
          <Textarea
            ref={inputRef}
            aria-label="Message"
            className="max-h-48 min-h-10"
            placeholder="Envoyer un message au bot (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
            maxLength={4000}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
          <Button
            size="icon"
            aria-label="Envoyer"
            disabled={send.isPending || (!text.trim() && images.length === 0)}
            onClick={submit}
          >
            <Send />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChatRow({
  item,
  botName,
  botAvatar,
}: {
  item: ChatItem;
  botName: string;
  botAvatar?: string;
}) {
  if (item.kind === 'notice') {
    return <p className="text-muted-foreground text-xs italic">{item.text}</p>;
  }
  if (item.kind === 'event') {
    const { result } = item;
    return (
      <div className="grid gap-1 rounded-md border border-orange-300/40 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 font-medium text-orange-300">
          <Radar className="size-4" aria-hidden />
          Règle « {result.name} » déclenchée
        </span>
        <span className="text-muted-foreground">{result.reason}</span>
        {result.dmPreview && <p className="text-xs">MP prévu : {result.dmPreview}</p>}
        {result.channelPreview && (
          <p className="text-xs">Message de salon prévu : {result.channelPreview}</p>
        )}
      </div>
    );
  }
  const isBot = item.kind === 'bot';
  const name = isBot ? botName : item.author;
  return (
    <div className="flex gap-3">
      {isBot && botAvatar ? (
        <img src={botAvatar} alt="" className="size-9 shrink-0 rounded-full" />
      ) : (
        <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-full text-sm">
          {isBot ? <Bot className="size-4" aria-hidden /> : name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="grid min-w-0 gap-1 text-sm">
        <span className="flex items-baseline gap-2">
          <span className={isBot ? 'text-primary font-medium' : 'font-medium'}>{name}</span>
          {isBot && <span className="bg-primary rounded px-1 text-[10px] text-white">BOT</span>}
          <span className="text-muted-foreground text-xs">{item.time}</span>
        </span>
        {item.text && <DiscordMarkdown text={item.text} />}
        {item.kind === 'user' && item.images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.images.map((src) => (
              <img key={src} src={src} alt="Image envoyée" className="max-h-48 rounded-md border" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function readImage(file: File): Promise<PendingImage> {
  const mimeType = PLAYGROUND_IMAGE_TYPES.find((type) => type === file.type);
  if (!mimeType) return Promise.reject(new Error(`${file.name} : PNG, JPEG ou WebP uniquement.`));
  if (file.size > PLAYGROUND_IMAGE_MAX_BYTES) {
    return Promise.reject(new Error(`${file.name} : 4 Mo maximum.`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const previewUrl = String(reader.result);
      resolve({ mimeType, data: previewUrl.slice(previewUrl.indexOf(',') + 1), previewUrl });
    };
    reader.onerror = () => reject(new Error(`${file.name} : lecture impossible.`));
    reader.readAsDataURL(file);
  });
}
