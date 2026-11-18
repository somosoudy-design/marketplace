'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createApi, createKoraClient, type ProductQuestion } from '@kora/api';
import { MessageCircle } from 'lucide-react';
import { useAccount } from '@/lib/providers';
import { captureBuyerApi } from '@/lib/actor-api';
import { authHref } from '@/lib/auth-return';
import { env } from '@/lib/env';

type Props = { productId: string; slug: string; routePath?: string; seller: string };
const pageSize = 10;
const questionDate = (date: string) =>
  new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

export function ProductQuestions(props: Props) {
  const { session } = useAccount();
  return (
    <QuestionsSession key={`${props.productId}:${session?.user.id ?? 'guest'}`} {...props} actor={session?.user.id} />
  );
}

function QuestionsSession({ productId, slug, routePath, seller, actor }: Props & { actor?: string }) {
  const { ready } = useAccount();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState('');
  const submitting = useRef(false);
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const queryKey = ['product-questions', productId, actor ?? 'guest'];
  const questions = useQuery({
    queryKey: [...queryKey, page],
    enabled: ready,
    queryFn: async () => {
      if (!actor) {
        // Public reads must not adopt a later browser session while this request is running.
        const client = createKoraClient({ url: env.url, anonKey: env.anon, accessToken: env.anon, retryReads: false });
        return createApi(client).questions.list(productId, pageSize, page * pageSize);
      }
      const captured = await captureBuyerApi(actor);
      const data = await captured.api.questions.list(productId, pageSize, page * pageSize);
      await captured.assertCurrent();
      return data;
    },
  });
  const fresh = questions.isSuccess && !questions.isFetching;
  const canAsk = fresh && questions.data.can_ask;
  const returned = params?.get('section') === 'preguntas';
  useEffect(() => {
    if (returned && ready) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'start' });
    }
  }, [returned, ready]);
  const back = new URLSearchParams();
  for (const key of ['variant', 'v']) {
    const value = params?.get(key);
    if (value) back.set(key, value);
  }
  back.set('section', 'preguntas');
  const login = authHref('/cuenta', (routePath ?? '/p/' + encodeURIComponent(slug)) + '?' + back);
  const ask = useMutation({
    mutationFn: async (text: string) => {
      if (!actor || !mounted.current) throw new Error('Inicia sesión para enviar tu pregunta.');
      const captured = await captureBuyerApi(actor);
      await captured.assertCurrent();
      if (!mounted.current) throw new Error('La cuenta cambió. Vuelve a abrir tu pregunta.');
      const result = await captured.api.questions.ask(productId, text);
      await captured.assertCurrent();
      return result;
    },
    onSettled: () => {
      submitting.current = false;
    },
    onSuccess: () => {
      if (!mounted.current) return;
      setBody('');
      setEditing(false);
      setPage(0);
      setNotice('Pregunta enviada. Recibirás un aviso cuando la tienda responda.');
      void qc.invalidateQueries({ queryKey });
    },
  });
  return (
    <section id="preguntas" className="product-questions" aria-labelledby="questions-title">
      <div className="questions-heading">
        <div>
          <h2 id="questions-title" ref={heading} tabIndex={-1}>
            Preguntas y respuestas
          </h2>
          <p className="muted">Resuelve tus dudas con {seller} antes de comprar.</p>
        </div>
        {ready && !actor ? (
          <Link prefetch={false} className="button secondary" href={login}>
            <MessageCircle size={17} />
            Hacer una pregunta
          </Link>
        ) : actor && questions.data?.can_ask ? (
          <button
            className="button secondary"
            disabled={ask.isPending || !canAsk}
            onClick={() => {
              if (submitting.current || !canAsk) return;
              setEditing(!editing);
              ask.reset();
              setNotice('');
            }}
            aria-expanded={editing}
            aria-controls="question-editor"
          >
            <MessageCircle size={17} />
            Hacer una pregunta
          </button>
        ) : null}
      </div>
      {notice && (
        <p className="question-feedback" role="status">
          {notice}
        </p>
      )}
      {editing && actor && (
        <form
          id="question-editor"
          className="question-editor"
          onSubmit={(event) => {
            event.preventDefault();
            if (!submitting.current && canAsk && body.trim().length >= 10 && body.length <= 500) {
              submitting.current = true;
              ask.mutate(body.trim());
            }
          }}
        >
          <label htmlFor="question-body">Tu pregunta</label>
          <textarea
            id="question-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            minLength={10}
            maxLength={500}
            rows={3}
            required
            disabled={ask.isPending}
            aria-describedby="question-hint"
            autoFocus
          />
          <p id="question-hint" className="muted">
            {body.length}/500 · Evita teléfonos, correos y enlaces. Tu pregunta y la respuesta serán públicas; las
            consultas de pedidos se atienden desde Mis compras.
          </p>
          {ask.isError && (
            <p role="alert" className="error">
              {ask.error.message}
            </p>
          )}
          <div className="question-form-actions">
            <button
              className="button"
              disabled={ask.isPending || !canAsk || body.trim().length < 10 || body.length > 500}
              aria-busy={ask.isPending}
            >
              {ask.isPending ? 'Enviando…' : 'Enviar pregunta'}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={ask.isPending}
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {questions.isPending ? (
        <p className="muted" role="status">
          Cargando preguntas…
        </p>
      ) : questions.isError && !questions.data ? (
        <div role="alert" className="question-load-error">
          <p>No pudimos cargar las preguntas.</p>
          <button className="button secondary" onClick={() => void questions.refetch()}>
            Reintentar
          </button>
        </div>
      ) : questions.data?.items.length ? (
        <ul className="question-list">
          {questions.data.items.map((question) => (
            <QuestionRow
              key={question.id}
              question={question}
              actor={actor}
              canAnswer={questions.data.can_answer}
              canModerate={questions.data.can_moderate}
              editable={fresh}
              refresh={() => qc.invalidateQueries({ queryKey })}
            />
          ))}
        </ul>
      ) : (
        <div className="question-empty">
          <MessageCircle size={23} aria-hidden="true" />
          <div>
            <strong>
              {questions.data?.count ? 'No hay preguntas en esta página' : 'Aún no hay preguntas respondidas'}
            </strong>
            <p className="muted">Puedes consultar detalles, compatibilidad o lo que incluye el producto.</p>
          </div>
        </div>
      )}
      {questions.isError && questions.data && (
        <div role="alert" className="question-load-error">
          <p>No pudimos actualizar las preguntas. Conservamos lo que estabas escribiendo.</p>
          <button type="button" className="button secondary" onClick={() => void questions.refetch()}>
            Reintentar
          </button>
        </div>
      )}
      {questions.data && (page > 0 || (page + 1) * pageSize < questions.data.count) && (
        <nav className="question-pagination" aria-label="Páginas de preguntas">
          <button
            className="button secondary"
            disabled={page === 0 || questions.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Anteriores
          </button>
          <span>Página {page + 1}</span>
          <button
            className="button secondary"
            disabled={(page + 1) * pageSize >= questions.data.count || questions.isFetching}
            onClick={() => setPage(page + 1)}
          >
            Siguientes
          </button>
        </nav>
      )}
    </section>
  );
}

function QuestionRow({
  question: q,
  actor,
  canAnswer,
  canModerate,
  editable,
  refresh,
}: {
  question: ProductQuestion;
  actor?: string;
  canAnswer: boolean;
  canModerate: boolean;
  editable: boolean;
  refresh: () => Promise<unknown>;
}) {
  const [action, setAction] = useState<'answer' | 'moderate' | null>(null);
  const [body, setBody] = useState(q.answer_body ?? '');
  const [reason, setReason] = useState('');
  const [moderationHide, setModerationHide] = useState(true);
  const permitted =
    editable && (action === 'answer' ? canAnswer && q.status === 'published' : action === 'moderate' && canModerate);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const save = useMutation({
    mutationFn: async (snapshot: { action: 'answer' | 'moderate'; text: string; hide: boolean }) => {
      if (!actor || !mounted.current) throw new Error('Revisa tu sesión antes de continuar.');
      const captured = await captureBuyerApi(actor);
      await captured.assertCurrent();
      if (!mounted.current) throw new Error('La cuenta cambió.');
      const result =
        snapshot.action === 'answer'
          ? await captured.api.questions.answer(q.id, snapshot.text)
          : await captured.api.questions.moderate(q.id, snapshot.hide, snapshot.text);
      await captured.assertCurrent();
      return result;
    },
    onSettled: () => {
      submitting.current = false;
    },
    onSuccess: async () => {
      if (mounted.current) {
        setAction(null);
        await refresh();
      }
    },
  });
  return (
    <li className="question-item">
      <div className="question-meta">
        <span>{q.mine ? 'Tu pregunta' : q.author}</span>
        <time dateTime={q.created_at}>{questionDate(q.created_at)}</time>
        {q.status === 'hidden' && <span>Oculta</span>}
      </div>
      <p className="question-body">{q.body}</p>
      {q.answer_body ? (
        <div className="question-answer">
          <strong>Respuesta de {q.store_name}</strong>
          <p>{q.answer_body}</p>
          {q.answered_at && <time dateTime={q.answered_at}>{questionDate(q.answered_at)}</time>}
        </div>
      ) : (
        <p className="question-pending">Esperando respuesta de la tienda</p>
      )}
      {q.status === 'hidden' && q.hidden_reason && <p className="muted">Motivo: {q.hidden_reason}</p>}
      {(canAnswer || canModerate) && actor && (
        <div className="question-row-actions">
          {canAnswer && q.status === 'published' && (
            <button
              className="button secondary"
              disabled={save.isPending || !editable}
              onClick={() => {
                if (submitting.current || !editable) return;
                setBody(q.answer_body ?? '');
                setAction('answer');
                save.reset();
              }}
            >
              {q.answer_body ? 'Editar respuesta' : 'Responder'}
            </button>
          )}
          {canModerate && (
            <button
              className="button secondary"
              disabled={save.isPending || !editable}
              onClick={() => {
                if (submitting.current || !editable) return;
                setModerationHide(q.status !== 'hidden');
                setAction('moderate');
                setReason('');
                save.reset();
              }}
            >
              {q.status === 'hidden' ? 'Volver a publicar' : 'Ocultar pregunta'}
            </button>
          )}
        </div>
      )}
      {action && (
        <form
          className="question-editor"
          onSubmit={(event) => {
            event.preventDefault();
            const text = action === 'answer' ? body.trim() : reason.trim();
            const valid = action === 'answer' ? text.length >= 1 && body.length <= 1000 : !moderationHide || !!text;
            if (!submitting.current && action && permitted && valid) {
              submitting.current = true;
              save.mutate({ action, text, hide: moderationHide });
            }
          }}
        >
          {action === 'answer' ? (
            <>
              <label htmlFor={`answer-${q.id}`}>Respuesta pública</label>
              <textarea
                id={`answer-${q.id}`}
                rows={3}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                minLength={1}
                maxLength={1000}
                required
                disabled={save.isPending}
                autoFocus
              />
              <p className="muted">Evita datos personales, teléfonos, correos y enlaces.</p>
            </>
          ) : moderationHide ? (
            <>
              <label htmlFor={`reason-${q.id}`}>Motivo para ocultar</label>
              <select
                id={`reason-${q.id}`}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={save.isPending}
              >
                <option value="">Elige un motivo</option>
                <option>Incluye datos personales</option>
                <option>Lenguaje ofensivo</option>
                <option>Publicidad o enlaces externos</option>
                <option>No habla del producto</option>
              </select>
              <p className="muted">La persona que preguntó podrá ver este motivo.</p>
            </>
          ) : (
            <p>La pregunta volverá a ser visible según su estado de respuesta.</p>
          )}
          {save.isError && (
            <p className="error" role="alert">
              {save.error.message}
            </p>
          )}
          <div className="question-form-actions">
            <button
              className="button"
              disabled={
                save.isPending ||
                !permitted ||
                (action === 'answer' ? body.trim().length < 1 || body.length > 1000 : moderationHide && !reason)
              }
              aria-busy={save.isPending}
            >
              {save.isPending ? 'Guardando…' : action === 'answer' ? 'Publicar respuesta' : 'Confirmar'}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={save.isPending}
              onClick={() => setAction(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
