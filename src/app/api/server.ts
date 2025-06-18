import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import cors from "cors";

import { workflow } from "../inmo.js";
import { SYSTEM_PROMPT_TEMPLATE } from "../constants.js";

const PORT = process.env.PORT || 5000;


const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Mapeo de thread_id → datos del cliente
const clientInfoByThread = new Map<
  string,
  {
    ws: WebSocket;
    runId: string;
    run_id: string;
  }
>();

const connectedClients = new Set<WebSocket>();

// Endpoint custom para elevenlabs conversationl
const threadLocks = new Map<string, boolean>();

app.post("/v1/chat/completions", async (req, res) => {
  const { messages, stream, elevenlabs_extra_body } = req.body;
  const last_message = messages.at(-1);
  const { threadId, runId, runIdConfig } = elevenlabs_extra_body || {};

  console.log("last message: ", last_message);

  if (last_message?.role !== "user") {
    res.status(400).json({
      error: "El último mensaje debe ser del usuario",
    });
    return;
  }

  if (!stream) {
    res.status(400).json({ error: "Solo soporta stream=true" });
    return;
  }

  
  
  
  try {
      const agentResp = await workflow.invoke(
          { messages: last_message },
          {
              configurable: {
                  thread_id:threadId,
                  run_id: runIdConfig,
                  systemPromptTemplate: SYSTEM_PROMPT_TEMPLATE,
                  model: "gpt-4o",
                },
                runId,
                streamMode: "updates" as const,
            }
        );
        
        const state = await workflow.getState({
            configurable: { thread_id: threadId },
        });

        
        const clientInfo = threadId && clientInfoByThread.get(threadId);
        // console.log("State values:", state.values);

        if(state.values.ui.length > 0 && clientInfo) {
            console.log("props", state.values.ui.at(-1)?.props)
           
            
            clientInfo.ws.send(
                JSON.stringify({
                    type: "ui",
                    data: state.values.ui.at(-1)?.props
                }))
        }
   



   

    let reply = "";

    if (Array.isArray(agentResp)) {
      reply =
        agentResp.at(-1)?.agent.messages[0]?.content ??
        "No hay respuesta del agente";
    }

    const id = Date.now().toString();
    const created = Math.floor(Date.now() / 1000);
    const chunk = {
      id,
      object: "chat.completion.chunk",
      created,
      model: "gpt-4-o",
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            content:
              reply === ""
                ? "Muy bien, voy a realizar la búsqueda, espera un momento por favor"
                : reply,
          },
          finish_reason: "stop",
        },
      ],
    };

    console.log("Enviando respuesta a ElevenLabs");
  
    
    
    // res.json(chunk); // ← RESPUESTA NORMAL HTTP
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    res.write("data: [DONE]\n\n");

    res.end();
    return;
  } catch (err: any) {
    console.error("Error en /v1/chat/completions:", err);
    res.status(500).json({
      error: err.message ?? "Error desconocido del servidor",
    });
    return;
  }
});

// Endpoint para enviar props (ejecutado desde LangGraph o alguna tool)
app.post("/api/enviar-cars", (req, res) => {
  const cars = req.body.cars;
  if (!Array.isArray(cars)) {
    res.status(400).json({ error: "Faltan los cars (deben ser un array)" });
    return;
  }

  const message = JSON.stringify({ type: "cars", data: cars });
  connectedClients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });

  res.json({ ok: true });
});

// 👇 Registro via WebSocket
wss.on("connection", (ws) => {
    console.log("[WS] Nueva conexión establecida");
  ws.on("message", (msg) => {

     console.log("[WS] Mensaje crudo recibido:", msg.toString());

     let data;
  
  try {
    data = JSON.parse(msg.toString());
    console.log("[WS] Parsed message:", data);
  } catch (err) {
    console.error("[WS] JSON inválido:", err);
    return;
  }


    try {
      data = JSON.parse(msg.toString());
    } catch {
      return;
    }
    if (data.type !== "register" || !data.thread_id) return;

    clientInfoByThread.set(data.thread_id, {
      ws,
      runId: data.runId,
      run_id: data.runIdConfig,
    });
    console.log(`[WS] Registrado thread ${data.thread_id}`);
  });

  ws.on("close", () => {
    clientInfoByThread.forEach((info, thread_id) => {
      if (info.ws === ws) {
        clientInfoByThread.delete(thread_id);
        console.log(`[WS] Desregistrado thread ${thread_id}`);
        return;
      }
    });
  });
});

server.listen(PORT, () => {
  console.log("Servidor corriendo en http://localhost:" + PORT);
});

/*
    Ya tengo pasado desde el front el thread_id y los run que puedo hacer:_ Opción básica: Persistencia con localStorage
    generar un id guardarlo e ir a buscarlo cada vez que recargue y que se borre si desmonta
    Pero primero debo saber como langgraph agent guarda un id en la url para poder utilizar ese y hacerlo mas complejo

    - Ya estoy leyendo el state y con ello la ui ára poder enviar los componentes y que los renderice.. ademas puedo gestionarlos por thread_id enviado desde el cliente

    - Esa interfaz y endpont funcionan bien desde "new.con.ts"


*/
