import { useEffect, useState } from "react";
import { AlertTriangle, Bot, Check, CircleDollarSign, Gauge, LayoutDashboard, MessageCircle, Send, ShieldCheck, Sparkles, TicketCheck, WalletCards, X } from "lucide-react";
import { api } from "./api";

const example = "Gasté 25 dólares en comida ayer en Mi Comisariato";
const categories = ["Alimentación", "Transporte", "Vivienda", "Salud", "Educación", "Entretenimiento", "Servicios", "Otros"];

function MoneyCard({ label, value, icon: Icon, tone = "navy" }) {
  return (
    <article className={`money-card ${tone}`}>
      <div className="icon-wrap"><Icon size={20} /></div>
      <div><span>{label}</span><strong>{value}</strong></div>
    </article>
  );
}

function App() {
  const [activeView, setActiveView] = useState("home");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState([]);
  const [summary, setSummary] = useState({ income: 1000, expenses: 0, balance: 1000, transaction_count: 0 });
  const [transactions, setTransactions] = useState([]);
  const [mode, setMode] = useState("Conectando...");
  const [budgets, setBudgets] = useState([]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ category: "Alimentación", amount_limit: 100, threshold_pct: 80 });
  const [editingBudget, setEditingBudget] = useState(null);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportResult, setSupportResult] = useState(null);
  const [ticketResult, setTicketResult] = useState(null);
  const [merchantCorrection, setMerchantCorrection] = useState("");
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketFilter, setTicketFilter] = useState("ALL");
  const [waMessage, setWaMessage] = useState("");
  const [waDraft, setWaDraft] = useState(null);
  const [waMessages, setWaMessages] = useState([
    { role: "agent", text: "Hola, soy Saldo Claro. Cuéntame un gasto y lo revisaré antes de registrarlo." },
  ]);
  const [waLinkNotice, setWaLinkNotice] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const [summaryData, transactionData, health, budgetData, ticketData] = await Promise.all([
      api.summary(), api.transactions(), api.health(), api.budgets(), api.tickets(),
    ]);
    setSummary(summaryData);
    setTransactions(transactionData);
    setMode(health.agent_mode);
    setBudgets(budgetData);
    setTickets(ticketData);
  };

  useEffect(() => { refresh().catch(() => setMode("Backend desconectado")); }, []);

  const interpret = async (event) => {
    event.preventDefault();
    if (!message.trim()) return;
    setLoading(true); setStatus("");
    try {
      const result = await api.interpret(message);
      setDraft(result.draft); setErrors(result.validation_errors); setMode(result.mode);
    } catch (error) { setStatus(error.message); }
    finally { setLoading(false); }
  };

  const confirm = async () => {
    setLoading(true);
    try {
      const result = await api.confirm(draft);
      setStatus(result.message); setDraft(null); setMessage(""); await refresh();
    } catch (error) { setStatus(error.message); }
    finally { setLoading(false); }
  };

  const completeCategory = (category) => {
    setDraft((current) => ({
      ...current,
      category,
      missing_fields: current.missing_fields.filter((field) => field !== "category"),
      requires_clarification: current.missing_fields.filter((field) => field !== "category").length > 0,
      clarification_question: null,
    }));
    setErrors((current) => current.filter((error) => !error.toLowerCase().includes("categoría")));
  };

  const completeMerchant = () => {
    const merchant = merchantCorrection.trim();
    if (merchant.length < 2) return;
    setDraft((current) => {
      const remaining = current.missing_fields.filter((field) => field !== "merchant");
      return {
        ...current,
        merchant,
        missing_fields: remaining,
        requires_clarification: remaining.length > 0,
        clarification_question: null,
      };
    });
    setErrors((current) => current.filter((error) => !error.toLowerCase().includes("comercio")));
    setMerchantCorrection("");
  };

  const saveBudget = async (event) => {
    event.preventDefault();
    const month = new Date().toISOString().slice(0, 7);
    try {
      const result = await api.saveBudget({ ...budgetForm, month });
      setStatus(result.message); setShowBudgetForm(false); setEditingBudget(null); await refresh();
    } catch (error) { setStatus(error.message); }
  };

  const editBudget = (budget) => {
    setBudgetForm({
      category: budget.category,
      amount_limit: budget.amount_limit,
      threshold_pct: budget.threshold_pct,
    });
    setEditingBudget(budget.id);
    setShowBudgetForm(true);
  };

  const removeBudget = async (budget) => {
    if (!window.confirm(`¿Eliminar el presupuesto de ${budget.category}?`)) return;
    try {
      const result = await api.deleteBudget(budget.id);
      setStatus(result.message);
      if (editingBudget === budget.id) { setEditingBudget(null); setShowBudgetForm(false); }
      await refresh();
    } catch (error) { setStatus(error.message); }
  };

  const askSupport = async (event) => {
    event.preventDefault();
    if (!supportMessage.trim()) return;
    try { setSupportResult(await api.support(supportMessage)); setTicketResult(null); }
    catch (error) { setStatus(error.message); }
  };

  const escalate = async () => {
    try {
      const ticket = await api.createTicket({
        case_type: supportResult.case_type,
        summary: supportMessage,
        history: `Usuario: ${supportMessage}\nAsistente: ${supportResult.answer}`,
        priority: supportResult.priority,
      });
      setTicketResult(ticket);
      await refresh();
    } catch (error) { setStatus(error.message); }
  };

  const askWhatsApp = async (event) => {
    event.preventDefault();
    const text = waMessage.trim();
    if (!text) return;
    setWaMessages((current) => [...current, { role: "user", text }]);
    setWaMessage("");
    try {
      const result = await api.interpret(text);
      setWaDraft(result.draft);
      if (result.validation_errors.length > 0) {
        setWaMessages((current) => [...current, {
          role: "agent",
          text: result.draft.clarification_question || result.validation_errors[0],
        }]);
      } else {
        setWaMessages((current) => [...current, {
          role: "agent",
          text: `Entendí: $${result.draft.amount.toFixed(2)}, ${result.draft.category}, ${result.draft.merchant}, ${result.draft.date}. ¿Lo registro?`,
        }]);
      }
    } catch (error) {
      setWaMessages((current) => [...current, { role: "agent", text: error.message }]);
    }
  };

  const confirmWhatsApp = async () => {
    try {
      await api.confirm(waDraft);
      setWaMessages((current) => [...current, { role: "agent", text: "Registrado. Tu dashboard ya fue actualizado." }]);
      setWaDraft(null);
      await refresh();
    } catch (error) {
      setWaMessages((current) => [...current, { role: "agent", text: error.message }]);
    }
  };

  const changeTicketStatus = async (status) => {
    try {
      const updated = await api.updateTicketStatus(selectedTicket.id, status);
      setSelectedTicket(updated);
      await refresh();
    } catch (error) { setStatus(error.message); }
  };

  const visibleTickets = ticketFilter === "ALL"
    ? tickets
    : tickets.filter((ticket) => ticket.status === ticketFilter);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">S</div><div><b>Saldo Claro</b><span>Finanzas que hablan contigo</span></div></div>
        <nav>
          <button className={activeView === "home" ? "active" : ""} onClick={() => setActiveView("home")}><LayoutDashboard size={18}/> Mi espacio</button>
          <button className={activeView === "budgets" ? "active" : ""} onClick={() => setActiveView("budgets")}><WalletCards size={18}/> Presupuestos</button>
          <button className={activeView === "whatsapp" ? "active" : ""} onClick={() => setActiveView("whatsapp")}><MessageCircle size={18}/> WhatsApp</button>
          <button className={activeView === "support" ? "active" : ""} onClick={() => setActiveView("support")}><ShieldCheck size={18}/> Soporte</button>
          <button className={activeView === "tickets" ? "active" : ""} onClick={() => setActiveView("tickets")}><TicketCheck size={18}/> Tickets <span className="nav-count">{tickets.length}</span></button>
        </nav>
        <div className="security-note"><ShieldCheck size={21}/><div><b>Acciones verificadas</b><span>La IA nunca guarda sin tu confirmación.</span></div></div>
      </aside>

      <main>
        <header><div><p className="eyebrow">BUEN DÍA, ANA</p><h1>Tu dinero, más claro.</h1><p>Registra un gasto como se lo contarías a una persona.</p></div><span className="mode"><span></span>{mode}</span></header>

        <section className="metrics">
          <MoneyCard label="Ingresos" value={`$${summary.income.toFixed(2)}`} icon={CircleDollarSign} tone="teal" />
          <MoneyCard label="Gastos" value={`$${summary.expenses.toFixed(2)}`} icon={WalletCards} tone="coral" />
          <MoneyCard label="Saldo disponible" value={`$${summary.balance.toFixed(2)}`} icon={ShieldCheck} />
        </section>

        {activeView === "home" && <section className="workspace">
          <div className="chat-panel">
            <div className="panel-heading"><div><span className="bot-icon"><Bot size={20}/></span><div><h2>Agente financiero</h2><p>Entiendo lenguaje cotidiano y pregunto antes de actuar.</p></div></div></div>
            <div className="conversation">
              <div className="bubble agent">Hola, Ana. ¿Qué movimiento quieres registrar hoy?</div>
              {message && draft && <div className="bubble user">{message}</div>}
              {draft && <div className="draft-card">
                <div className="draft-title"><Sparkles size={17}/><b>Esto entendí</b><span>Borrador</span></div>
                <div className="draft-grid">
                  <div><small>Monto</small><strong>{draft.amount ? `$${draft.amount.toFixed(2)}` : "Falta"}</strong></div>
                  <div><small>Fecha</small><strong>{draft.date || "Falta"}</strong></div>
                  <div><small>Categoría</small><strong>{draft.category || "Falta"}</strong></div>
                  <div><small>Comercio</small><strong>{draft.merchant || "Falta"}</strong></div>
                </div>
                {draft.missing_fields.includes("category") && <div className="clarification-box">
                  <label htmlFor="category">{draft.clarification_question || "¿A qué categoría corresponde?"}</label>
                  <select id="category" defaultValue="" onChange={(event) => completeCategory(event.target.value)}>
                    <option value="" disabled>Selecciona una categoría</option>
                    {categories.map((category) => <option value={category} key={category}>{category}</option>)}
                  </select>
                </div>}
                {draft.missing_fields.includes("merchant") && <div className="clarification-box">
                  <label htmlFor="merchant">¿En qué comercio realizaste el gasto?</label>
                  <div className="correction-row">
                    <input id="merchant" value={merchantCorrection} onChange={(event) => setMerchantCorrection(event.target.value)} placeholder="Ejemplo: Tía" />
                    <button type="button" onClick={completeMerchant} disabled={merchantCorrection.trim().length < 2}>Aplicar</button>
                  </div>
                </div>}
                {errors.length > 0 && !draft.missing_fields.includes("category") && !draft.missing_fields.includes("merchant") && <div className="clarification">{errors[0]}</div>}
                {errors.length === 0 && <div className="draft-actions"><button className="confirm" onClick={confirm} disabled={loading}><Check size={17}/>Confirmar y registrar</button><button onClick={() => setDraft(null)}><X size={17}/>Cancelar</button></div>}
              </div>}
              {status && <div className="status-message">{status}</div>}
            </div>
            <form className="composer" onSubmit={interpret}>
              <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder={example} />
              <button aria-label="Enviar" disabled={loading}><Send size={19}/></button>
            </form>
            <button className="example" onClick={() => setMessage(example)}>Usar mensaje de ejemplo</button>
          </div>

          <div className="activity-panel">
            <div className="activity-heading"><h2>Actividad reciente</h2><span>{summary.transaction_count} movimientos</span></div>
            {transactions.length === 0 ? <div className="empty"><WalletCards size={30}/><b>Aún no hay gastos</b><span>Confirma tu primer movimiento desde el chat.</span></div> : transactions.slice(0, 6).map((item) => <div className="transaction" key={item.id}><div className="merchant-avatar">{item.merchant[0]}</div><div><b>{item.merchant}</b><span>{item.category} · {item.transaction_date}</span></div><strong>-${item.amount.toFixed(2)}</strong></div>)}
          </div>
        </section>}

        {activeView === "budgets" && <section className="budget-section standalone">
          <div className="section-title"><div><p className="eyebrow">CONTROL MENSUAL</p><h2>Presupuestos y alertas</h2></div><button onClick={() => { setEditingBudget(null); setBudgetForm({ category: "Alimentación", amount_limit: 100, threshold_pct: 80 }); setShowBudgetForm(!showBudgetForm); }}>+ Crear presupuesto</button></div>
          {showBudgetForm && <form className="budget-form" onSubmit={saveBudget}>
            <label>Categoría<select value={budgetForm.category} onChange={(e) => setBudgetForm({...budgetForm, category: e.target.value})}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Límite mensual ($)<input type="number" min="1" step="0.01" value={budgetForm.amount_limit} onChange={(e) => setBudgetForm({...budgetForm, amount_limit: Number(e.target.value)})}/></label>
            <label>Alertar al (%)<input type="number" min="50" max="100" value={budgetForm.threshold_pct} onChange={(e) => setBudgetForm({...budgetForm, threshold_pct: Number(e.target.value)})}/></label>
            <button type="submit">{editingBudget ? "Guardar cambios" : "Guardar presupuesto"}</button>
          </form>}
          {budgets.length === 0 ? <div className="budget-empty"><Gauge size={24}/><span>Crea un presupuesto para recibir alertas basadas en tus gastos reales.</span></div> : <div className="budget-grid">{budgets.map((budget) => <article className={`budget-card ${budget.status}`} key={budget.id}>
            <div className="budget-top"><div><b>{budget.category}</b><span>${budget.spent.toFixed(2)} de ${budget.amount_limit.toFixed(2)}</span></div>{budget.status !== "ok" && <AlertTriangle size={20}/>}</div>
            <div className="progress"><span style={{width: `${Math.min(budget.percentage, 100)}%`}}></span></div>
            <div className="budget-meta"><span>{budget.percentage}% utilizado</span><span>Alerta: {budget.threshold_pct}%</span></div>
            {budget.status === "warning" && <p className="budget-alert">Has usado ${budget.spent.toFixed(2)} de ${budget.amount_limit.toFixed(2)}. Superaste tu umbral de ${budget.threshold_amount.toFixed(2)}.</p>}
            {budget.status === "exceeded" && <p className="budget-alert">Excediste este presupuesto por ${(budget.spent - budget.amount_limit).toFixed(2)}.</p>}
            <div className="budget-actions"><button onClick={() => editBudget(budget)}>Editar</button><button className="delete-budget" onClick={() => removeBudget(budget)}>Eliminar</button></div>
          </article>)}</div>}
        </section>}

        {activeView === "support" && <section className="support-section standalone">
          <div className="section-title"><div><p className="eyebrow">SOPORTE RESPONSABLE</p><h2>Centro de soporte</h2></div><span className="approved-badge"><ShieldCheck size={15}/>Base aprobada</span></div>
          <div className="support-layout">
            <form className="support-form" onSubmit={askSupport}>
              <label htmlFor="support-message">Pregunta sobre tu cuenta, procesos o documentos</label>
              <textarea id="support-message" value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} placeholder="Ejemplo: No reconozco una operación de $320 y quiero reclamar." />
              <div className="support-examples">
                <button type="button" onClick={() => setSupportMessage("¿Qué documentos necesito para actualizar mis datos?")}>Información</button>
                <button type="button" onClick={() => setSupportMessage("No reconozco una operación de $320. Puede ser fraude.")}>Fraude</button>
                <button type="button" onClick={() => setSupportMessage("Mi clave está bloqueada y no puedo acceder a mi cuenta.")}>Acceso bloqueado</button>
                <button type="button" onClick={() => setSupportMessage("Quiero presentar un reclamo formal por un cobro incorrecto.")}>Reclamo</button>
                <button type="button" onClick={() => setSupportMessage("Tengo una solicitud regulatoria de cumplimiento.")}>Regulatorio</button>
                <button type="button" onClick={() => setSupportMessage("Hay una diferencia en mi estado de cuenta y un documento faltante.")}>Documentos</button>
                <button className="primary" type="submit">Consultar soporte</button>
              </div>
            </form>
            <div className="support-response">
              {!supportResult && <div className="support-empty"><Bot size={26}/><span>La respuesta aparecerá aquí con su fuente o ruta de escalamiento.</span></div>}
              {supportResult && <>
                <div className={`intent ${supportResult.requires_human ? "sensitive" : "info"}`}>{supportResult.requires_human ? "Requiere atención humana" : "Consulta informativa"}</div>
                <p>{supportResult.answer}</p>
                {supportResult.sources.length > 0 && <small>Fuente: {supportResult.sources.join(", ")}</small>}
                {supportResult.requires_human && !ticketResult && <button className="escalate" onClick={escalate}>Crear ticket y transferir</button>}
                {ticketResult && <div className="ticket-success"><Check size={18}/><div><b>Ticket #{ticketResult.id} creado</b><span>Prioridad {ticketResult.priority} · Estado {ticketResult.status}</span></div></div>}
              </>}
            </div>
          </div>
        </section>}

        {activeView === "whatsapp" && <section className="whatsapp-section">
          <div className="channel-heading"><div><span className="whatsapp-logo"><MessageCircle size={22}/></span><div><p className="eyebrow">CANAL MASIVO</p><h2>WhatsApp</h2></div></div><button className="link-whatsapp" onClick={() => setWaLinkNotice(!waLinkNotice)}><MessageCircle size={15}/>Vincular WhatsApp API</button></div>
          {waLinkNotice && <div className="whatsapp-link-panel"><span>Configura un número de WhatsApp Business y el webhook del agente.</span><button onClick={() => window.open("https://developers.facebook.com/docs/whatsapp/cloud-api/get-started", "_blank")}>Configurar</button></div>}
          <div className="phone-shell">
            <div className="phone-header"><div className="wa-avatar">S</div><div><b>Saldo Claro</b><span>Agente financiero · en línea</span></div></div>
            <div className="wa-chat">
              {waMessages.map((item, index) => <div key={`${item.role}-${index}`} className={`wa-bubble ${item.role}`}>{item.text}<small>{new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</small></div>)}
              {waDraft && !waDraft.requires_clarification && <div className="wa-confirm">
                <b>Movimiento pendiente</b><span>Gemini estructuró los datos; todavía no se ha guardado.</span>
                <div><button onClick={confirmWhatsApp}><Check size={16}/> Confirmar</button><button onClick={() => setWaDraft(null)}><X size={16}/> Cancelar</button></div>
              </div>}
            </div>
            <form className="wa-composer" onSubmit={askWhatsApp}><input value={waMessage} onChange={(e) => setWaMessage(e.target.value)} placeholder="Escribe un mensaje"/><button><Send size={18}/></button></form>
          </div>
          <p className="simulation-note"><ShieldCheck size={16}/>Este canal simula la experiencia de WhatsApp. No utiliza un número real ni envía datos a Meta.</p>
        </section>}

        {activeView === "tickets" && <section className="tickets-section">
          <div className="section-title"><div><p className="eyebrow">ESCALAMIENTO HUMANO</p><h2>Bandeja de tickets</h2></div><span className="approved-badge"><TicketCheck size={15}/>{tickets.length} casos</span></div>
          <div className="ticket-filters">{[["ALL","Todos"],["ESCALATED","Escalados"],["IN_REVIEW","En revisión"],["CLOSED","Cerrados"]].map(([value,label]) => <button key={value} className={ticketFilter === value ? "active" : ""} onClick={() => setTicketFilter(value)}>{label}</button>)}</div>
          {tickets.length === 0 ? <div className="ticket-empty"><TicketCheck size={28}/><b>No hay tickets todavía</b><span>Crea un caso sensible desde Soporte para probar el escalamiento.</span><button onClick={() => setActiveView("support")}>Ir a soporte</button></div> : <div className="tickets-layout">
            <div className="ticket-list">{visibleTickets.length === 0 ? <div className="filtered-empty">No hay tickets con este estado.</div> : visibleTickets.map((ticket) => <button key={ticket.id} className={selectedTicket?.id === ticket.id ? "selected" : ""} onClick={() => setSelectedTicket(ticket)}><div><b>Ticket #{ticket.id}</b><span>{ticket.summary}</span></div><div><em className={`priority ${ticket.priority.toLowerCase()}`}>{ticket.priority}</em><small>{ticket.status}</small></div></button>)}</div>
            <div className="ticket-detail">{selectedTicket ? <>
              <div className="ticket-detail-head"><div><small>CASO #{selectedTicket.id}</small><h3>{selectedTicket.summary}</h3></div><em className={`priority ${selectedTicket.priority.toLowerCase()}`}>{selectedTicket.priority}</em></div>
              <dl><div><dt>Tipo</dt><dd>{selectedTicket.case_type}</dd></div><div><dt>Estado</dt><dd>{selectedTicket.status}</dd></div><div><dt>Creado</dt><dd>{selectedTicket.created_at}</dd></div></dl>
              <h4>Historial entregado al equipo humano</h4><pre>{selectedTicket.history}</pre>
              <div className="ticket-actions"><span>Actualizar caso:</span><button onClick={() => changeTicketStatus("ESCALATED")}>Reabrir</button><button onClick={() => changeTicketStatus("IN_REVIEW")}>En revisión</button><button className="close-ticket" onClick={() => changeTicketStatus("CLOSED")}>Cerrar ticket</button></div>
            </> : <div className="select-ticket"><TicketCheck size={28}/><span>Selecciona un ticket para revisar su contexto e historial.</span></div>}</div>
          </div>}
        </section>}
      </main>
    </div>
  );
}

export default App;
