import React, {
  useState,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  MemoryRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Package,
  Truck,
  Database,
  RefreshCw,
  AlertTriangle,
  LogOut,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Zap,
  Cpu,
  Settings,
  Plus,
  Minus,
  Edit,
  Filter,
  ChevronDown,
  Search,
  Bell,
  Scan,
  Archive,
} from "lucide-react";

// --- 0. CONFIGURACIÓN Y UTILIDADES DE GEMINI API ---
const API_KEY = ""; // La clave se proporciona automáticamente en el entorno Canvas
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";
const BACKOFF_INITIAL_DELAY = 1000;
const MAX_RETRIES = 5;

/**
 * Función genérica para llamar a la API de Gemini con reintentos (exponential backoff).
 */
async function fetchGeminiText(
  userPrompt,
  systemInstruction,
  enableSearch = false
) {
  const payload = {
    contents: [{ parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
  };

  if (enableSearch) {
    payload.tools = [{ google_search: {} }];
  }

  const fetchWithOptions = async (delay, retryCount) => {
    try {
      const response = await fetch(`${API_URL}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 429 && retryCount < MAX_RETRIES) {
        // Too Many Requests (Rate Limit) -> Retry with backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithOptions(delay * 2, retryCount + 1);
      }

      if (!response.ok) {
        throw new Error(`API response failed: ${response.statusText}`);
      }

      const result = await response.json();
      const text =
        result.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No se pudo generar una respuesta.";
      return text;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithOptions(delay * 2, retryCount + 1);
      }
      console.error(
        "Error al llamar a la API de Gemini después de varios reintentos:",
        error
      );
      return "Error: No se pudo conectar con el servicio de IA.";
    }
  };

  return fetchWithOptions(BACKOFF_INITIAL_DELAY, 0);
}

// --- 1. CONTEXTO DE AUTENTICACIÓN ---
const AuthContext = createContext();

const useAuth = () => useContext(AuthContext);

// --- 2. SISTEMA DE TOASTS (NOTIFICACIONES) ---
const ToastContext = createContext();
const useToast = () => useContext(ToastContext);

function ToastNotification({ message, type, onClose }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  const Icon = type === "success" ? CheckCircle : AlertCircle;
  const bgColor = type === "success" ? "bg-green-500" : "bg-red-500";

  // TAMAÑO REDUCIDO EN UN 20%
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.5 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.7 }}
          className={`fixed bottom-3 right-3 z-50 flex items-center p-2 rounded-md shadow-lg text-white ${bgColor} max-w-xs`}
        >
          <Icon className="w-4 h-4 mr-1.5" />
          <div className="flex-1 text-xs font-medium">{message}</div>
          <button
            onClick={onClose}
            className="ml-2 p-0.5 hover:bg-white/20 rounded-full"
          >
            <X className="w-3 h-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Toast con opción de acción
function ActionToast({ message, type, onClose, onAction, actionText }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onClose, 8000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  const Icon = type === "success" ? CheckCircle : AlertCircle;
  const bgColor = type === "success" ? "bg-green-500" : "bg-red-500";

  // TAMAÑO REDUCIDO EN UN 20%
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.5 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.7 }}
          className={`fixed bottom-3 right-3 z-50 p-2.5 rounded-md shadow-lg text-white ${bgColor} max-w-xs`}
        >
          <div className="flex items-start">
            <Icon className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-xs font-medium">{message}</div>
            <button
              onClick={onClose}
              className="ml-2 p-0.5 hover:bg-white/20 rounded-full flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          {onAction && actionText && (
            <div className="mt-1.5 pt-1.5 border-t border-white/20">
              <button
                onClick={onAction}
                className="bg-white text-red-600 font-bold w-full py-1 rounded-md hover:bg-gray-100 text-[11px] transition"
              >
                {actionText}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [actionToast, setActionToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setActionToast(null);
  };

  const showActionToast = (message, type = "error", actionText, onAction) => {
    setActionToast({ message, type, actionText, onAction });
    setToast(null);
  };

  const hideToast = () => {
    setToast(null);
    setActionToast(null);
  };

  return (
    <ToastContext.Provider value={{ showToast, showActionToast }}>
      {children}
      <ToastNotification
        message={toast?.message}
        type={toast?.type}
        onClose={hideToast}
      />
      <ActionToast
        message={actionToast?.message}
        type={actionToast?.type}
        onClose={hideToast}
        onAction={actionToast?.onAction}
        actionText={actionToast?.actionText}
      />
    </ToastContext.Provider>
  );
}

// --- MOCKS DE INVENTARIO (DATA CONSOLIDADA) ---
// (Los MOCKs se mantienen inalterados ya que solo se reducen los visuales)
const MOCK_MATERIALES_BASE = [
  {
    sku: "CBL001",
    nombre: "Cable Coaxial RG-6",
    unidad: "Metros",
    stock: 15000,
    ubicacion: "Bodega Central",
    criticidad: "Alta",
  },
  {
    sku: "FIB005",
    nombre: "Fibra Óptica Monomodo (Indoor)",
    unidad: "Metros",
    stock: 5000,
    ubicacion: "Bodega Norte",
    criticidad: "Media",
  },
  {
    sku: "ADP100",
    nombre: "Adaptador SC/APC",
    unidad: "Unidades",
    stock: 8500,
    ubicacion: "Bodega Sur",
    criticidad: "Baja",
  },
  {
    sku: "CNCT02",
    nombre: "Conector F Macho",
    unidad: "Unidades",
    stock: 25000,
    ubicacion: "Bodega Central",
    criticidad: "Alta",
  },
  {
    sku: "CLMP01",
    nombre: "Grapa Plástica 1/4",
    unidad: "Unidades",
    stock: 50000,
    ubicacion: "Bodega Oeste",
    criticidad: "Baja",
  },
  {
    sku: "TAPE05",
    nombre: "Cinta Aislante Eléctrica",
    unidad: "Rollos",
    stock: 1500,
    ubicacion: "Bodega Sur",
    criticidad: "Baja",
  },
  {
    sku: "BATT12",
    nombre: "Batería Respaldo 12V",
    unidad: "Unidades",
    stock: 35000,
    ubicacion: "Bodega Norte",
    criticidad: "Media",
  },
];

// MOCK_MATERIALES (Triplicado)
const MOCK_MATERIALES = [
  ...MOCK_MATERIALES_BASE,
  // Duplicado 1
  ...MOCK_MATERIALES_BASE.map((item) => ({
    ...item,
    sku: item.sku + "A",
    stock: Math.floor(item.stock * 1.2), // Aumento de stock simulado
    ubicacion: item.ubicacion
      .replace("Central", "Regional")
      .replace("Norte", "Este")
      .replace("Sur", "Oeste")
      .replace("Oeste", "Norte"),
  })),
  // Duplicado 2 con nuevos SKUs y detalles
  {
    sku: "SPLT04",
    nombre: "Splitter 1x4 HFC",
    unidad: "Unidades",
    stock: 12000,
    ubicacion: "Bodega Central",
    criticidad: "Media",
  },
  {
    sku: "ONTF01",
    nombre: "ONT Fibra Óptica Gigabit",
    unidad: "Unidades",
    stock: 9000,
    ubicacion: "Bodega Este",
    criticidad: "Alta",
  },
  {
    sku: "AMP02",
    nombre: "Amplificador de Señal HFC",
    unidad: "Unidades",
    stock: 3000,
    ubicacion: "Bodega Norte",
    criticidad: "Media",
  },
  {
    sku: "FIBR50",
    nombre: "Bobina Fibra 500m (Exterior)",
    unidad: "Rollos",
    stock: 100,
    ubicacion: "Bodega Oeste",
    criticidad: "Alta",
  },
  {
    sku: "ADP101",
    nombre: "Adaptador SC/UPC",
    unidad: "Unidades",
    stock: 1500,
    ubicacion: "Bodega Regional",
    criticidad: "Baja",
  },
  {
    sku: "CNCT03",
    nombre: "Conector RJ-45 Cat 6",
    unidad: "Unidades",
    stock: 45000,
    ubicacion: "Bodega Sur",
    criticidad: "Alta",
  },
  {
    sku: "BRKT01",
    nombre: "Soporte de Antena",
    unidad: "Unidades",
    stock: 8000,
    ubicacion: "Bodega Central",
    criticidad: "Baja",
  },
  {
    sku: "FUSN01",
    nombre: "Manguito de Fusión",
    unidad: "Unidades",
    stock: 20000,
    ubicacion: "Bodega Este",
    criticidad: "Media",
  },
];

const MOCK_EQUIPOS_SERIALIZADOS_BASE = [
  {
    serial: "DEC987654321",
    tipo: "Decodificador 4K",
    tecnologia: "HFC",
    estado: "Asignado a Técnico",
    tecnicoId: "T001",
    tecnicoNombre: "Juan Pérez",
    ubicacion: "Vehículo T001",
  },
  {
    serial: "RTR112233445",
    tipo: "Router Wi-Fi 6",
    tecnologia: "Fibra Optica",
    estado: "Disponible en Bodega",
    tecnicoId: "",
    tecnicoNombre: "",
    ubicacion: "Bodega Central",
  },
  {
    serial: "MOD654321098",
    tipo: "Modem Cable DOCSIS 3.1",
    tecnologia: "HFC",
    estado: "Instalado en Cliente",
    tecnicoId: "C12345",
    tecnicoNombre: "Cliente",
    ubicacion: "Cliente ID C12345",
  },
  {
    serial: "DEC102938475",
    tipo: "Decodificador HD",
    tecnologia: "Satelital",
    estado: "En Proceso RMA",
    tecnicoId: "",
    tecnicoNombre: "",
    ubicacion: "Centro de Reparación",
  },
  {
    serial: "RTR556677889",
    tipo: "Router Mesh Extender",
    tecnologia: "Fibra Optica",
    estado: "Disponible en Bodega",
    tecnicoId: "",
    tecnicoNombre: "",
    ubicacion: "Bodega Norte",
  },
  {
    serial: "MOD99877665",
    tipo: "Modem Fibra GPON",
    tecnologia: "Fibra Optica",
    estado: "Asignado a Técnico",
    tecnicoId: "T015",
    tecnicoNombre: "Carlos Velez",
    ubicacion: "Vehículo T015",
  },
  {
    serial: "ANT001122334",
    tipo: "Antena Satelital",
    tecnologia: "Satelital",
    estado: "Disponible en Bodega",
    tecnicoId: "",
    tecnicoNombre: "",
    ubicacion: "Bodega Sur",
  },
  {
    serial: "CCTV554433221",
    tipo: "Cámara CCTV",
    tecnologia: "HFC",
    estado: "Disponible en Bodega",
    tecnicoId: "",
    tecnicoNombre: "",
    ubicacion: "Bodega Norte",
  },
  {
    serial: "RTR000111222",
    tipo: "Router Wi-Fi 6",
    tecnologia: "Fibra Optica",
    estado: "Disponible en Bodega",
    tecnicoId: "",
    tecnicoNombre: "",
    ubicacion: "Bodega Central",
  },
];

// Función auxiliar para generar seriales aleatorios y únicos
const generateUniqueSerial = (prefix, index) => {
  return (
    prefix +
    (Math.floor(Math.random() * 90000000) + 10000000)
      .toString()
      .padStart(8, "0") +
    index.toString().padStart(2, "0")
  );
};

const tiposEquipo = [
  "Decodificador 4K",
  "Router Wi-Fi 6",
  "Modem DOCSIS 3.1",
  "Decodificador HD",
  "Router Mesh Extender",
  "Modem Fibra GPON",
  "Antena Satelital",
  "Cámara CCTV",
  "ONT GPON",
  "Switch Ethernet",
];
const tecnologias = ["HFC", "Fibra Optica", "Satelital"];
const ubicacionesBodega = [
  "Bodega Central",
  "Bodega Norte",
  "Bodega Sur",
  "Bodega Oeste",
  "Bodega Este",
  "Bodega Regional",
];
const tecnicos = [
  { id: "T001", nombre: "Juan Pérez" },
  { id: "T005", nombre: "Ana López" },
  { id: "T015", nombre: "Carlos Velez" },
  { id: "T022", nombre: "Maria Soto" },
  { id: "T030", nombre: "Felipe Diaz" },
  { id: "T045", nombre: "Laura Rojas" },
  { id: "T050", nombre: "Ricardo Gómez" },
  { id: "T061", nombre: "Elena Castro" },
  { id: "T072", nombre: "David Niño" },
];

const estados = [
  "Disponible en Bodega",
  "Asignado a Técnico",
  "Instalado en Cliente",
  "En Proceso RMA",
];

// Generar 3 veces la cantidad base de seriales (aprox 27 seriales)
const MOCK_EQUIPOS_SERIALIZADOS_EXTRAS = Array.from({ length: 18 }).map(
  (_, index) => {
    const tech = tecnicos[index % tecnicos.length];
    const estado = estados[Math.floor(Math.random() * estados.length)];
    const tipo = tiposEquipo[Math.floor(Math.random() * tiposEquipo.length)];
    const tecnologia =
      tecnologias[Math.floor(Math.random() * tecnologias.length)];
    const isAssigned = estado === "Asignado a Técnico";
    const isInstalled = estado === "Instalado en Cliente";

    return {
      serial: generateUniqueSerial(
        tipo.substring(0, 3).toUpperCase(),
        index + 10
      ),
      tipo: tipo,
      tecnologia: tecnologia,
      estado: estado,
      tecnicoId: isAssigned
        ? tech.id
        : isInstalled
        ? `C${Math.floor(Math.random() * 90000) + 10000}`
        : "",
      tecnicoNombre: isAssigned ? tech.nombre : isInstalled ? "Cliente" : "",
      ubicacion: isAssigned
        ? `Vehículo ${tech.id}`
        : isInstalled
        ? `Cliente ID ${Math.floor(Math.random() * 90000) + 10000}`
        : ubicacionesBodega[
            Math.floor(Math.random() * ubicacionesBodega.length)
          ],
    };
  }
);

const MOCK_EQUIPOS_SERIALIZADOS_INITIAL = [
  ...MOCK_EQUIPOS_SERIALIZADOS_BASE,
  ...MOCK_EQUIPOS_SERIALIZADOS_EXTRAS,
];

const MOCK_CONSUMO_DIARIO_BASE = [
  {
    tecnicoId: "T001",
    nombre: "Juan Pérez",
    fecha: "2025-11-12",
    equiposInstalados: 5,
    materialesConsumidos: 120,
    estadoSincro: "Sincronizado OK y enviado a SAP",
  },
  {
    tecnicoId: "T005",
    nombre: "Ana López",
    fecha: "2025-11-12",
    equiposInstalados: 3,
    materialesConsumidos: 80,
    estadoSincro: "Sincronizado OK y enviado a SAP",
  },
  {
    tecnicoId: "T015",
    nombre: "Carlos Velez",
    fecha: "2025-11-12",
    equiposInstalados: 4,
    materialesConsumidos: 95,
    estadoSincro: "Error Consumo Material OFSC",
  },
  {
    tecnicoId: "T022",
    nombre: "Maria Soto",
    fecha: "2025-11-12",
    equiposInstalados: 6,
    materialesConsumidos: 150,
    estadoSincro: "Sincronizado OK y enviado a SAP",
  },
  {
    tecnicoId: "T030",
    nombre: "Felipe Diaz",
    fecha: "2025-11-12",
    equiposInstalados: 2,
    materialesConsumidos: 50,
    estadoSincro: "Sincronizado OK y enviado a SAP",
  },
  {
    tecnicoId: "T045",
    nombre: "Laura Rojas",
    fecha: "2025-11-12",
    equiposInstalados: 1,
    materialesConsumidos: 30,
    estadoSincro: "Error Envío SAP - Duplicidad",
  },
  {
    tecnicoId: "T001",
    nombre: "Juan Pérez",
    fecha: "2025-11-13",
    equiposInstalados: 4,
    materialesConsumidos: 100,
    estadoSincro: "Sincronizado OK y enviado a SAP",
  },
  {
    tecnicoId: "T005",
    nombre: "Ana López",
    fecha: "2025-11-13",
    equiposInstalados: 0,
    materialesConsumidos: 10,
    estadoSincro: "Sincronizado OK y enviado a SAP",
  },
  {
    tecnicoId: "T022",
    nombre: "Maria Soto",
    fecha: "2025-11-13",
    equiposInstalados: 5,
    materialesConsumidos: 130,
    estadoSincro: "Error Consumo Material OFSC",
  },
  {
    tecnicoId: "T015",
    nombre: "Carlos Velez",
    fecha: "2025-11-11",
    equiposInstalados: 2,
    materialesConsumidos: 45,
    estadoSincro: "Sincronizado OK y enviado a SAP",
  },
  {
    tecnicoId: "T045",
    nombre: "Laura Rojas",
    fecha: "2025-11-11",
    equiposInstalados: 3,
    materialesConsumidos: 70,
    estadoSincro: "Error Envío SAP - Duplicidad",
  },
];

// MOCK_CONSUMO_DIARIO (Triplicado)
const MOCK_CONSUMO_DIARIO_EXTRAS = [
  // Duplicado y variación en fechas y errores
  ...MOCK_CONSUMO_DIARIO_BASE.map((item) => ({
    ...item,
    fecha: item.fecha
      .replace("12", "14")
      .replace("13", "15")
      .replace("11", "13"), // Variar fechas
    equiposInstalados: Math.floor(item.equiposInstalados * 0.8) + 1, // Variar números
    materialesConsumidos: Math.floor(item.materialesConsumidos * 1.1),
    estadoSincro: item.estadoSincro.includes("Error")
      ? "Revisado OK y re-enviado"
      : item.estadoSincro,
  })),
  // Nuevos técnicos y fechas
  {
    tecnicoId: "T050",
    nombre: "Ricardo Gómez",
    fecha: "2025-11-14",
    equiposInstalados: 7,
    materialesConsumidos: 180,
    estadoSincro: "Sincronizado OK y enviado a SAP",
  },
  {
    tecnicoId: "T061",
    nombre: "Elena Castro",
    fecha: "2025-11-14",
    equiposInstalados: 3,
    materialesConsumidos: 60,
    estadoSincro: "Sincronizado OK y enviado a SAP",
  },
  {
    tecnicoId: "T072",
    nombre: "David Niño",
    fecha: "2025-11-14",
    equiposInstalados: 1,
    materialesConsumidos: 40,
    estadoSincro: "Error Falta Autorización",
  },
  {
    tecnicoId: "T050",
    nombre: "Ricardo Gómez",
    fecha: "2025-11-15",
    equiposInstalados: 5,
    materialesConsumidos: 140,
    estadoSincro: "Sincronizado OK y enviado a SAP",
  },
  {
    tecnicoId: "T061",
    nombre: "Elena Castro",
    fecha: "2025-11-15",
    equiposInstalados: 0,
    materialesConsumidos: 15,
    estadoSincro: "Sincronizado OK y enviado a SAP",
  },
  {
    tecnicoId: "T001",
    nombre: "Juan Pérez",
    fecha: "2025-11-10",
    equiposInstalados: 6,
    materialesConsumidos: 130,
    estadoSincro: "Error Consumo Material OFSC",
  },
  {
    tecnicoId: "T045",
    nombre: "Laura Rojas",
    fecha: "2025-11-14",
    equiposInstalados: 4,
    materialesConsumidos: 85,
    estadoSincro: "Sincronizado OK y enviado a SAP",
  },
];

const MOCK_CONSUMO_DIARIO_INITIAL = [
  ...MOCK_CONSUMO_DIARIO_BASE,
  ...MOCK_CONSUMO_DIARIO_EXTRAS,
];

const MOCK_RMA_DANADO_BASE = [
  {
    serial: "DEC102938475",
    tipo: "Decodificador HD",
    tecnologia: "Satelital",
    estado: "Dañado - Baja",
    causal: "Fallo de Encendido",
    fechaRegistro: "2025-10-25",
    tecnicoReporta: "T001",
    nombreTecnico: "Juan Pérez",
  },
  {
    serial: "RTR001122334",
    tipo: "Router Wi-Fi 5",
    tecnologia: "HFC",
    estado: "RMA - Pendiente Revisión",
    causal: "Devolución Cliente (Cancelación)",
    fechaRegistro: "2025-10-28",
    tecnicoReporta: "T022",
    nombreTecnico: "Maria Soto",
  },
  {
    serial: "MOD776655443",
    tipo: "Modem DOCSIS 3.0",
    tecnologia: "HFC",
    estado: "RMA - Pendiente Revisión",
    causal: "Intermitencia Reportada",
    fechaRegistro: "2025-11-01",
    tecnicoReporta: "T005",
    nombreTecnico: "Ana López",
  },
  {
    serial: "DEC555444333",
    tipo: "Decodificador 4K",
    tecnologia: "Fibra Optica",
    estado: "Dañado - Centro Reparación",
    causal: "Golpe/Daño Físico",
    fechaRegistro: "2025-11-05",
    tecnicoReporta: "T015",
    nombreTecnico: "Carlos Velez",
  },
];

const MOCK_CAUSALES_RMA = [
  "Fallo de Encendido",
  "Intermitencia Reportada",
  "Devolución Cliente (Cancelación)",
  "Golpe/Daño Físico",
  "Falla de Conectividad",
  "Mala Calidad de Señal",
  "Equipo Obsoleto (Upgrade)",
  "Falla de Software",
  "Daño por Rayo",
  "No Retornó (Pérdida)",
];

const estadosRMA = [
  "RMA - Pendiente Revisión",
  "Dañado - Baja",
  "Dañado - Centro Reparación",
  "RMA - Aprobado para Devolución",
];

// MOCK_RMA_DANADO (Triplicado)
const MOCK_RMA_DANADO_EXTRAS = Array.from({ length: 8 }).map((_, index) => {
  const tech = tecnicos[index % tecnicos.length];
  const causal =
    MOCK_CAUSALES_RMA[Math.floor(Math.random() * MOCK_CAUSALES_RMA.length)];
  const estado = estadosRMA[Math.floor(Math.random() * estadosRMA.length)];
  const tipo = tiposEquipo[Math.floor(Math.random() * tiposEquipo.length)];
  const tecnologia =
    tecnologias[Math.floor(Math.random() * tecnologias.length)];

  // Generar fecha aleatoria entre el 15 de Oct y hoy
  const start = new Date(2025, 9, 15);
  const end = new Date();
  const randomDate = new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
  const fechaRegistro = randomDate.toISOString().slice(0, 10);

  return {
    serial: generateUniqueSerial(tipo.substring(0, 3).toUpperCase(), index + 5),
    tipo: tipo,
    tecnologia: tecnologia,
    estado: estado,
    causal: causal,
    fechaRegistro: fechaRegistro,
    tecnicoReporta: tech.id,
    nombreTecnico: tech.nombre,
  };
});

const MOCK_RMA_DANADO_INITIAL = [
  ...MOCK_RMA_DANADO_BASE,
  ...MOCK_RMA_DANADO_EXTRAS,
];

const MOCK_TECNOLOGIA_SERVICIOS_BASE = [
  {
    tecnologia: "HFC",
    descripcion: "Hybrid Fiber-Coaxial",
    servicios_compatibles: [
      {
        codigo: "INT_DOCSIS50",
        nombre: "Internet Cable 50 Mbps",
        tipo: "Internet",
      },
      {
        codigo: "INT_DOCSIS300",
        nombre: "Internet Cable 300 Mbps",
        tipo: "Internet",
      },
      { codigo: "TV_DIG_BAS", nombre: "Televisión Digital Básica", tipo: "TV" },
      { codigo: "TV_DIG_PLUS", nombre: "Televisión Digital Plus", tipo: "TV" },
      {
        codigo: "TEL_FIJA_EST",
        nombre: "Telefonía Fija Estándar",
        tipo: "Telefonía",
      },
    ],
  },
  {
    tecnologia: "Fibra Optica",
    descripcion: "Fiber to the Home (GPON)",
    servicios_compatibles: [
      { codigo: "INT_GIGA", nombre: "Internet Fibra 1 Gbps", tipo: "Internet" },
      {
        codigo: "INT_500",
        nombre: "Internet Fibra 500 Mbps",
        tipo: "Internet",
      },
      { codigo: "TV_IP_PREM", nombre: "Televisión IP Premium", tipo: "TV" },
      {
        codigo: "PAQ_FIBRA_TRP",
        nombre: "Paquete Triple Play Fibra",
        tipo: "Bundle",
      },
    ],
  },
  {
    tecnologia: "Satelital",
    descripcion: "Direct-to-Home (DTH)",
    servicios_compatibles: [
      {
        codigo: "TV_SAT_BAS",
        nombre: "Televisión Satelital Básica",
        tipo: "TV",
      },
      { codigo: "TV_SAT_HD", nombre: "Televisión Satelital HD", tipo: "TV" },
    ],
  },
];

// MOCK_TECNOLOGIA_SERVICIOS (Triplicado)
const MOCK_TECNOLOGIA_SERVICIOS = [
  ...MOCK_TECNOLOGIA_SERVICIOS_BASE.map((tech) => ({
    ...tech,
    servicios_compatibles: [
      ...tech.servicios_compatibles,
      // Agregar servicios de ejemplo al MOCK_TECNOLOGIA_SERVICIOS
      ...(tech.tecnologia === "HFC"
        ? [
            {
              codigo: "INT_DOCSIS100",
              nombre: "Internet Cable 100 Mbps",
              tipo: "Internet",
            },
            {
              codigo: "PAQ_HFC_TRP",
              nombre: "Paquete Triple Play HFC",
              tipo: "Bundle",
            },
          ]
        : []),
      ...(tech.tecnologia === "Fibra Optica"
        ? [
            {
              codigo: "INT_200",
              nombre: "Internet Fibra 200 Mbps",
              tipo: "Internet",
            },
            { codigo: "TV_IP_BAS", nombre: "Televisión IP Básica", tipo: "TV" },
          ]
        : []),
      ...(tech.tecnologia === "Satelital"
        ? [
            {
              codigo: "TV_SAT_PREM",
              nombre: "Televisión Satelital Premium",
              tipo: "TV",
            },
          ]
        : []),
    ],
  })),
  // Agregar una nueva tecnología de ejemplo (ej. Red Fija)
  {
    tecnologia: "Red Fija Cobre",
    descripcion: "Antigua red de cobre para servicios de voz y datos (ADSL)",
    servicios_compatibles: [
      {
        codigo: "TEL_FIJA_AVZ",
        nombre: "Telefonía Fija Avanzada",
        tipo: "Telefonía",
      },
      {
        codigo: "INT_ADSL10",
        nombre: "Internet ADSL 10 Mbps",
        tipo: "Internet",
      },
    ],
  },
  {
    tecnologia: "Móvil 5G",
    descripcion:
      "Red de quinta generación para servicios de Internet de alta velocidad",
    servicios_compatibles: [
      { codigo: "MOV_DATOS_ILM", nombre: "Datos Ilimitados", tipo: "Móvil" },
      { codigo: "MOV_VOZ_PL", nombre: "Voz Plan Corporativo", tipo: "Móvil" },
    ],
  },
];

// --- MANEJO DE ESTADOS GLOBALES (SIMULADO) ---

// Se usa un estado para simular la actualización del inventario y la asignación
const InventoryContext = createContext();

const useInventory = () => useContext(InventoryContext);

function InventoryProvider({ children }) {
  const [serializados, setSerializados] = useState(
    MOCK_EQUIPOS_SERIALIZADOS_INITIAL
  );
  const [consumoDiario, setConsumoDiario] = useState(
    MOCK_CONSUMO_DIARIO_INITIAL
  );
  const [rmaEquipos, setRmaEquipos] = useState(MOCK_RMA_DANADO_INITIAL);

  // Función para asignar un serial a un técnico
  const assignSerialToTech = (serial, tecnicoId, tecnicoNombre) => {
    const itemIndex = serializados.findIndex((item) => item.serial === serial);

    if (itemIndex === -1) {
      // Serial no encontrado
      return {
        success: false,
        code: "NOT_FOUND",
        message: `Error: Serial ${serial} no encontrado.`,
      };
    }

    const currentItem = serializados[itemIndex];
    if (currentItem.estado !== "Disponible en Bodega") {
      // Serial encontrado, pero no disponible para asignación
      return {
        success: false,
        code: "NOT_AVAILABLE",
        message: `Error: Serial ${serial} no está disponible. Estado: ${currentItem.estado}.`,
      };
    }

    // Asignación exitosa
    const newSerializados = [...serializados];
    newSerializados[itemIndex] = {
      ...currentItem,
      estado: "Asignado a Técnico",
      tecnicoId: tecnicoId,
      tecnicoNombre: tecnicoNombre,
      ubicacion: `Vehículo ${tecnicoId}`,
    };

    setSerializados(newSerializados);
    return {
      success: true,
      code: "ASSIGNED",
      message: `Equipo ${serial} asignado a ${tecnicoNombre} (${tecnicoId}).`,
    };
  };

  // Función para agregar un nuevo serial (usado en Logísticas si no existe)
  const addNewSerial = (newSerialData) => {
    const newSerial = {
      serial: newSerialData.serial.toUpperCase(),
      tipo: newSerialData.tipo,
      tecnologia: newSerialData.tecnologia,
      estado: "Disponible en Bodega", // Siempre entra como disponible
      tecnicoId: "",
      tecnicoNombre: "",
      ubicacion: newSerialData.ubicacion,
    };

    if (serializados.some((item) => item.serial === newSerial.serial)) {
      return {
        success: false,
        message: `El serial ${newSerial.serial} ya existe en el inventario.`,
      };
    }

    setSerializados((prev) => [...prev, newSerial]);
    return {
      success: true,
      message: `Serial ${newSerial.serial} agregado exitosamente como Disponible en Bodega.`,
    };
  };

  // FUNCIÓN: Registrar Serial en RMA
  const registerRMA = (rmaData) => {
    const { serial, causal, tecnicoId, nombreTecnico } = rmaData;

    // 1. Verificar si el serial ya está en RMA
    if (rmaEquipos.some((item) => item.serial === serial)) {
      return {
        success: false,
        message: `El serial ${serial} ya está registrado en RMA.`,
      };
    }

    // 2. Buscar en inventario serializado
    const itemIndex = serializados.findIndex((item) => item.serial === serial);
    let tipo = "Desconocido";
    let tecnologia = "N/A";

    if (itemIndex !== -1) {
      const currentItem = serializados[itemIndex];
      tipo = currentItem.tipo;
      tecnologia = currentItem.tecnologia;

      // Mover de Serializados a RMA (Cambiar estado y limpiar asignación)
      const newSerializados = serializados.filter(
        (item) => item.serial !== serial
      );
      setSerializados(newSerializados);
    } else {
      // Si el serial no existe en serializados, se asume que es un serial nuevo
      // o un serial que ya había sido eliminado/instalado
      // Se le asigna un tipo genérico si no se proporciona, pero para la simulación lo simplificamos
      tipo =
        rmaData.tipoEquipo ||
        tiposEquipo[Math.floor(Math.random() * tiposEquipo.length)];
      tecnologia =
        rmaData.tecnologiaEquipo ||
        tecnologias[Math.floor(Math.random() * tecnologias.length)];
    }

    // 3. Crear el nuevo registro RMA
    const newRMA = {
      serial: serial,
      tipo: tipo,
      tecnologia: tecnologia,
      estado: "RMA - Pendiente Revisión",
      causal: causal,
      fechaRegistro: new Date().toISOString().slice(0, 10), // Fecha actual
      tecnicoReporta: tecnicoId,
      nombreTecnico: nombreTecnico,
    };

    setRmaEquipos((prev) => [...prev, newRMA]);
    return {
      success: true,
      message: `Serial ${serial} registrado en RMA con causal: ${causal}.`,
    };
  };

  return (
    <InventoryContext.Provider
      value={{
        serializados,
        setSerializados,
        consumoDiario,
        setConsumoDiario,
        rmaEquipos,
        setRmaEquipos,
        assignSerialToTech,
        addNewSerial,
        registerRMA,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

// --- COMPONENTES REUTILIZABLES ---

/**
 * Componente Dropdown para el filtro de tabla
 */
function FilterDropdown({ accessor, options, activeFilters, onFilterChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const isActive = activeFilters[accessor]?.length > 0;

  // Cierra el dropdown si se hace click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  // Toggle filter value
  const handleToggle = (value) => {
    const currentFilters = activeFilters[accessor] || [];
    let newFilters;
    if (currentFilters.includes(value)) {
      newFilters = currentFilters.filter((f) => f !== value);
    } else {
      newFilters = [...currentFilters, value];
    }
    onFilterChange(accessor, newFilters);
  };

  // Clear filter
  const handleClear = () => {
    onFilterChange(accessor, []);
    setIsOpen(false);
  };

  // TAMAÑO REDUCIDO EN UN 20%
  return (
    <div className="relative inline-block text-left ml-0.5" ref={dropdownRef}>
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center p-0.5 rounded-full ${
            isActive
              ? "bg-red-200 text-red-700"
              : "text-gray-400 hover:text-red-600"
          } transition`}
          title={`Filtrar por ${accessor}`}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <Filter size={10} />
          <ChevronDown
            size={10}
            className={`ml-0.5 transform transition-transform ${
              isOpen ? "rotate-180" : "rotate-0"
            }`}
          />
        </button>
      </div>

      {/* Dropdown Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-10 mt-1 w-40 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="menu-button"
            tabIndex="-1"
          >
            <div className="py-0.5 max-h-48 overflow-y-auto">
              <button
                onClick={handleClear}
                className="block w-full text-left px-2 py-1 text-[10px] text-red-600 hover:bg-red-50 font-semibold border-b border-gray-100"
              >
                Limpiar Filtros
              </button>
              {options.map((option, index) => {
                const isChecked =
                  activeFilters[accessor]?.includes(option) || false;
                return (
                  <div
                    key={index}
                    className="flex items-center px-2 py-0.5 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      id={`filter-${accessor}-${index}`}
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(option)}
                      className="h-3 w-3 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <label
                      htmlFor={`filter-${accessor}-${index}`}
                      className="ml-1.5 block text-xs font-medium text-gray-700"
                    >
                      {option || "N/A"}
                    </label>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Componente principal de la tabla de inventario
 * @param {string} compactStyle - 'serial' o 'default'. Define si aplica la reducción extra.
 */
function InventoryTable({
  data,
  columns,
  title,
  renderExpansibleContent,
  filterableAccessors = [],
  compactStyle = "default",
}) {
  const [activeFilters, setActiveFilters] = useState({});

  // Define las clases de tamaño de fila y texto según el estilo compacto
  // 'serial' aplica la reducción EXTRA a la data (text-xs, py-1.5/px-2)
  const rowTextClass = compactStyle === "serial" ? "text-xs" : "text-sm";

  // *** AJUSTE SOLICITADO AQUÍ ***
  // Si es compactStyle='serial' (usado en Seriales e Integración), el encabezado usa text-xs (reducido 10% adicional)
  // Si es 'default', usa text-xs (base reducido 20%)
  const headerTextClass = compactStyle === "serial" ? "text-[11px]" : "text-xs";

  const headerPaddingClass =
    compactStyle === "serial" ? "px-2 py-1.5" : "px-3 py-2";
  const cellPaddingClass =
    compactStyle === "serial" ? "px-2 py-1.5" : "px-3 py-2";

  // Memoizar los datos filtrados
  const filteredData = useMemo(() => {
    if (Object.keys(activeFilters).length === 0) {
      return data;
    }

    return data.filter((item) => {
      // Un elemento debe cumplir con TODOS los filtros activos
      return Object.keys(activeFilters).every((accessor) => {
        const selectedValues = activeFilters[accessor];
        // Si no hay valores seleccionados para este accessor, pasa el filtro
        if (!selectedValues || selectedValues.length === 0) return true;

        // Si hay valores seleccionados, el valor del ítem debe estar en la selección
        const itemValue =
          typeof item[accessor] === "function"
            ? item[accessor]()
            : item[accessor];
        const normalizedItemValue =
          itemValue === "" || itemValue === null || itemValue === undefined
            ? "N/A"
            : itemValue;

        return selectedValues.includes(normalizedItemValue);
      });
    });
  }, [data, activeFilters]);

  // Memoizar las opciones de filtro para cada columna filtrable
  const filterOptions = useMemo(() => {
    const options = {};
    filterableAccessors.forEach((accessor) => {
      const uniqueValues = new Set(
        data.map((item) => {
          const value =
            typeof item[accessor] === "function"
              ? item[accessor]()
              : item[accessor];
          return value === "" || value === null || value === undefined
            ? "N/A"
            : value;
        })
      );
      options[accessor] = Array.from(uniqueValues).sort();
    });
    return options;
  }, [data, filterableAccessors]);

  // Manejador de cambio de filtro
  const handleFilterChange = (accessor, newValues) => {
    setActiveFilters((prev) => ({
      ...prev,
      [accessor]: newValues,
    }));
  };

  if (!data || data.length === 0) {
    // TAMAÑO REDUCIDO EN UN 20%
    return (
      <div className="p-3 bg-yellow-100 border-l-3 border-yellow-500 text-yellow-800 rounded-md text-sm">
        No hay datos disponibles.
      </div>
    );
  }

  // TAMAÑO BASE REDUCIDO EN UN 20% (p-4)
  return (
    <div className="bg-white p-4 rounded-lg shadow-lg mt-4">
      <h3 className="text-base font-bold text-gray-800 mb-2">{title}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col, index) => {
                const isFilterable = filterableAccessors.includes(col.accessor);
                return (
                  <th
                    key={index}
                    // Usa la clase de texto ajustada
                    className={`${headerPaddingClass} text-left ${headerTextClass} font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap`}
                  >
                    <div className="flex items-center">
                      {col.header}
                      {isFilterable && (
                        <FilterDropdown
                          accessor={col.accessor}
                          options={filterOptions[col.accessor] || []}
                          activeFilters={activeFilters}
                          onFilterChange={handleFilterChange}
                        />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredData.map((item, rowIndex) => (
              <React.Fragment key={rowIndex}>
                <tr className="hover:bg-red-50 transition duration-100">
                  {columns.map((col, colIndex) => (
                    <td
                      key={colIndex}
                      className={`${cellPaddingClass} whitespace-nowrap ${rowTextClass} text-gray-800`}
                    >
                      {typeof item[col.accessor] === "function"
                        ? item[col.accessor]()
                        : item[col.accessor]}
                    </td>
                  ))}
                </tr>
                {/* Renderiza el contenido expansible si se proporciona */}
                {renderExpansibleContent && (
                  <tr>
                    <td colSpan={columns.length} className="p-0">
                      {renderExpansibleContent(item)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-2 text-center text-sm text-gray-500"
                >
                  No se encontraron resultados que coincidan con los filtros
                  aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- COMPONENTES DE APLICACIÓN ---

function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const navigate = useNavigate();

  const login = (user, pass) => {
    // Simulación de autenticación: admin/admin
    if (user === "admin" && pass === "admin") {
      setLoggedIn(true);
      navigate("/");
      return true;
    }
    return false;
  };

  const logout = () => {
    setLoggedIn(false);
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ loggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function LoginClaro() {
  const { login, loggedIn } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [isAttemptingLogin, setIsAttemptingLogin] = useState(false);

  // Redirigir si ya está logueado
  useEffect(() => {
    if (loggedIn) {
      navigate("/", { replace: true });
    }
  }, [loggedIn, navigate]);

  const handleLogin = (e) => {
    e.preventDefault();
    setIsAttemptingLogin(true);
    // Simular un pequeño delay de red
    setTimeout(() => {
      const success = login(user, pass);
      if (!success) {
        showToast(
          "Credenciales incorrectas. Intenta con 'admin'/'admin'.",
          "error"
        );
      }
      setIsAttemptingLogin(false);
    }, 500);
  };

  // TAMAÑO REDUCIDO EN UN 20%
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <motion.div
        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-xs text-center border-t-4 border-red-600"
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-4xl mb-2" role="img" aria-label="Antena">
          📡
        </div>
        <h1 className="text-lg font-extrabold text-gray-800 mb-2">
          Portal de Inventarios Claro
        </h1>
        <p className="text-red-600 mb-4 text-xs font-semibold">
          Acceso Exclusivo para Logística y Operaciones
        </p>
        <form onSubmit={handleLogin} className="space-y-2.5">
          <input
            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition"
            placeholder="Usuario (admin)"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            disabled={isAttemptingLogin}
          />
          <input
            type="password"
            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition"
            placeholder="Contraseña (admin)"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            disabled={isAttemptingLogin}
          />
          <button
            type="submit"
            className="bg-red-600 text-white w-full py-2 rounded-lg font-bold hover:bg-red-700 transition duration-300 flex items-center justify-center gap-2 disabled:bg-red-400 text-sm"
            disabled={isAttemptingLogin}
          >
            {isAttemptingLogin && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            {isAttemptingLogin ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function HeaderClaro() {
  const { logout } = useAuth();

  // TAMAÑO REDUCIDO EN UN 20%
  return (
    <header className="flex items-center justify-between bg-red-600 text-white px-4 py-1.5 shadow-md">
      <div className="flex items-center space-x-1.5">
        <div className="text-lg font-extrabold" role="img" aria-label="Antena">
          📡
        </div>
        <h1 className="text-sm font-semibold">Portal de Inventarios Claro</h1>
      </div>
      <button
        onClick={logout}
        className="flex items-center gap-1 p-1 rounded-md hover:bg-white/10 transition text-xs"
      >
        <LogOut size={16} /> Salir
      </button>
    </header>
  );
}

function SidebarClaro() {
  const menus = [
    { to: "/", label: "Inicio", icon: Home },
    { to: "/catalogo", label: "Catálogo de Materiales", icon: Package },
    { to: "/seriales", label: "Administración de Seriales", icon: Database },
    { to: "/operaciones", label: "Operaciones Logísticas", icon: Truck },
    { to: "/rma", label: "RMA y Dañado", icon: AlertTriangle },
    { to: "/integracion", label: "Integración SAP/OFSC", icon: RefreshCw },
    {
      to: "/tecnologia-servicios",
      label: "Tecnología y Servicios",
      icon: Settings,
    },
  ];
  const location = useLocation();

  // Mantiene el tamaño REDUCIDO EN UN 20% (w-52)
  return (
    <nav className="w-52 bg-white h-full p-3 border-r border-gray-200 shadow-xl">
      <ul className="space-y-1.5">
        {menus.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className={`flex items-center gap-2 p-2.5 rounded-md transition duration-150 text-sm ${
                location.pathname === to ||
                (location.pathname === "/" && to === "/")
                  ? "bg-red-600 text-white shadow-lg"
                  : "text-gray-700 hover:bg-red-50 hover:text-red-600"
              }`}
            >
              <Icon size={16} /> <span className="font-medium">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// COMPONENTE PARA LAS TARJETAS DEL DASHBOARD
function StatCard({ title, value, icon: Icon, colorClass, linkTo }) {
  // TAMAÑO REDUCIDO EN UN 20% (p-4, text-2xl, w-6)
  return (
    <Link
      to={linkTo}
      className={`block rounded-lg shadow-lg p-4 ${colorClass} transition transform hover:scale-[1.02] duration-300`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium opacity-80">{title}</p>
          <p className="text-2xl font-extrabold mt-0.5">{value}</p>
        </div>
        <Icon className="w-6 h-6 opacity-40" />
      </div>
    </Link>
  );
}

function HomeClaro() {
  const { serializados, rmaEquipos } = useInventory();

  // Cálculo de métricas para el Dashboard
  const totalMaterialStock = MOCK_MATERIALES.reduce(
    (sum, item) => sum + item.stock,
    0
  );

  const totalSerializedEquipment = serializados.length + rmaEquipos.length; // Incluir RMA en el total
  const assignedEquipment = serializados.filter((e) =>
    e.tecnicoId.startsWith("T")
  ).length;
  const totalRma = rmaEquipos.length;
  const syncErrors = MOCK_CONSUMO_DIARIO_INITIAL.filter((c) =>
    c.estadoSincro.includes("Error")
  ).length;

  // Para la criticidad, el conteo es directo
  const criticalSkus = MOCK_MATERIALES.filter(
    (m) => m.criticidad === "Alta"
  ).length;

  // TAMAÑO REDUCIDO EN UN 20% (p-6, text-2xl, text-sm)
  return (
    <motion.div
      className="p-6 bg-gray-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Maestro de Inventarios Claro
      </h2>
      <p className="text-gray-600 mb-6 text-sm">
        Esta vista proporciona una descripción general consolidada y en tiempo
        real de los activos y existencias de la empresa. Permite a los usuarios
        monitorear los niveles de stock crítico, identificar tendencias de
        consumo y gestionar la ubicación física de los equipos y dispositivos
        para optimizar la cadena de suministro y minimizar el riesgo de
        desabastecimiento..
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Se mantiene la estructura con StatCard reducido */}
        <StatCard
          title="Materiales No Serializados (Unid.)"
          value={totalMaterialStock.toLocaleString()}
          icon={Package}
          colorClass="bg-red-600 text-white"
          linkTo="/catalogo"
        />

        <StatCard
          title="Total Equipos Serializados"
          value={totalSerializedEquipment.toLocaleString()}
          icon={Database}
          colorClass="bg-red-500 text-white"
          linkTo="/seriales"
        />

        <StatCard
          title="Equipos Asignados a Técnicos"
          value={assignedEquipment.toLocaleString()}
          icon={Truck}
          colorClass="bg-red-400 text-white"
          linkTo="/operaciones"
        />

        <StatCard
          title="Errores de Sincronización SAP/OFSC"
          value={syncErrors.toLocaleString()}
          colorClass={`text-white ${
            syncErrors > 0 ? "bg-yellow-600" : "bg-green-600"
          }`}
          linkTo="/integracion"
          icon={RefreshCw}
        />

        <StatCard
          title="Equipos en Proceso RMA/Dañado"
          value={totalRma.toLocaleString()}
          icon={AlertTriangle}
          colorClass="bg-purple-600 text-white"
          linkTo="/rma"
        />

        <StatCard
          title="SKUs con Criticidad Alta"
          value={criticalSkus.toLocaleString()}
          icon={AlertCircle}
          colorClass="bg-gray-700 text-white"
          linkTo="/catalogo"
        />
      </div>

      <div className="mt-6 bg-white p-4 rounded-lg border-l-4 border-red-600 shadow-md">
        <h3 className="text-lg font-bold text-red-800 mb-2">
          Flujo del Portal
        </h3>
        <ul className="space-y-1.5 text-gray-700 text-sm">
          <li className="flex items-center gap-2">
            <Package size={16} className="text-red-600" />{" "}
            <strong>Catálogo:</strong> Concentra el inventario de materiales (no
            serializados).
          </li>
          <li className="flex items-center gap-2">
            <Database size={16} className="text-red-600" />{" "}
            <strong>Seriales:</strong> Rastrea equipos por número de serie (ej.
            decodificadores).
          </li>
          <li className="flex items-center gap-2">
            <Truck size={16} className="text-red-600" />{" "}
            <strong>Operaciones:</strong> Muestra la asignación y consumo de
            inventario por técnico/cliente.
          </li>
          <li className="flex items-center gap-2">
            <RefreshCw size={16} className="text-red-600" />{" "}
            <strong>Integración:</strong> Monitorea el consumo diario y la
            sincronización **automática** con OFSC y SAP.
          </li>
          <li className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600" />{" "}
            <strong>RMA:</strong> Gestiona equipos dañados e incluye el análisis
            de causalidad.
          </li>
          <li className="flex items-center gap-2">
            <Settings size={16} className="text-red-600" />{" "}
            <strong>Tecnología y Servicios:</strong> Mapeo de tecnologías a
            servicios compatibles.
          </li>
        </ul>
      </div>
    </motion.div>
  );
}

/**
 * Dashboard de Alertas por Criticidad Baja
 */
function AlertaStockBajoDashboard() {
  const { showToast } = useToast();
  const STOCK_UMBRAL = 10000;

  // Filtra los materiales que cumplen el criterio de alerta
  const lowStockAlerts = useMemo(() => {
    return MOCK_MATERIALES.filter(
      (item) => item.criticidad === "Baja" && item.stock < STOCK_UMBRAL
    );
  }, []);

  const handleSendAlert = (item) => {
    // Simulación de envío de correo/notificación
    showToast(
      `Alerta enviada para ${item.sku} en ${item.ubicacion}. Stock actual: ${item.stock}.`,
      "success"
    );
  };

  // TAMAÑO REDUCIDO EN UN 20%
  return (
    <div className="mt-4 p-3 bg-yellow-50 border-l-3 border-yellow-500 rounded-md shadow-sm">
      <h3 className="text-sm font-bold text-yellow-800 flex items-center gap-1.5 mb-2">
        <Bell className="w-4 h-4" /> Alertas de Stock Crítico por Bodega
      </h3>
      <p className="text-xs text-gray-700 mb-3">
        Se muestran los materiales con **Criticidad Baja** cuyo stock disponible
        es **inferior a {STOCK_UMBRAL.toLocaleString()}**{" "}
        {MOCK_MATERIALES[0].unidad.toLowerCase()} en su respectiva bodega. Estos
        requieren reabastecimiento proactivo.
      </p>

      <AnimatePresence>
        {lowStockAlerts.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-1.5"
          >
            {lowStockAlerts.map((item) => (
              <div
                key={`${item.sku}-${item.ubicacion}`}
                className="p-2 bg-white border border-yellow-200 rounded-md flex items-center justify-between shadow-xs hover:shadow-sm transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate text-xs">
                    {item.nombre} ({item.sku})
                  </p>
                  <p className="text-[10px] text-yellow-600 font-bold mt-0.5">
                    Stock: {item.stock.toLocaleString()} {item.unidad} | Bodega:{" "}
                    {item.ubicacion}
                  </p>
                </div>
                <div>
                  <button
                    onClick={() => handleSendAlert(item)}
                    className="ml-2 bg-red-600 text-white px-2 py-1 rounded-md text-xs font-semibold hover:bg-red-700 transition flex items-center gap-1"
                  >
                    <Zap size={12} /> Alerta
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <div className="p-2.5 bg-green-100 border border-green-300 text-green-800 rounded-md">
            <p className="font-semibold flex items-center gap-1.5 text-xs">
              <CheckCircle size={14} /> ¡Sin Alertas de Stock Bajo!
            </p>
            <p className="text-[10px] mt-0.5">
              Todos los SKUs de criticidad baja están por encima del umbral de{" "}
              {STOCK_UMBRAL.toLocaleString()}.
            </p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CatalogoClaro() {
  const consolidatedMaterialData = MOCK_MATERIALES;

  const materialColumns = [
    { header: "SKU", accessor: "sku" },
    { header: "Nombre del Material", accessor: "nombre" },
    { header: "Unidad", accessor: "unidad" },
    { header: "Stock Disponible", accessor: "stock" },
    { header: "Ubicación Principal", accessor: "ubicacion" },
    { header: "Criticidad", accessor: "criticidad" },
  ];

  const filterableColumns = ["unidad", "ubicacion", "criticidad"];

  // TAMAÑO REDUCIDO EN UN 20%
  return (
    <motion.div
      className="p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-xl font-bold mb-3 text-red-600">
        Catálogo de Materiales Unificado (No Serializados)
      </h2>
      <p className="text-gray-600 mb-4 text-xs">
        Define SKUs y mapea materiales importados en tiempo real desde SAP para
        su uso en operaciones logísticas y de campo. Estos materiales (como
        cables, fibra óptica y adaptadores) no requieren seguimiento por unidad
        individual. (La tabla muestra existencias por bodega individualmente).
      </p>

      <InventoryTable
        data={consolidatedMaterialData}
        columns={materialColumns}
        title="Inventario Consumible (Stock Desagrupado por Bodega)"
        filterableAccessors={filterableColumns}
        compactStyle="default" // Usa el estilo base reducido
      />

      <AlertaStockBajoDashboard />
    </motion.div>
  );
}

function SerialesClaro() {
  const { serializados } = useInventory();

  // Columnas actualizadas para incluir "Tecnologia" y "tecnicoNombre"
  const serialColumns = [
    { header: "Serial", accessor: "serial" },
    { header: "Tipo de Equipo", accessor: "tipo" },
    { header: "Tecnología", accessor: "tecnologia" },
    { header: "Estado", accessor: "estado" },
    { header: "Asignado a ID", accessor: "tecnicoId" },
    { header: "Técnico/Cliente", accessor: "tecnicoNombre" }, // Nueva columna
    { header: "Ubicación Actual", accessor: "ubicacion" },
  ];

  // Columnas que queremos filtrar (Tipo, Tecnología, Estado y Ubicación)
  const filterableColumns = [
    "tipo",
    "tecnologia",
    "estado",
    "ubicacion",
    "tecnicoNombre",
  ];

  // TAMAÑO REDUCIDO EN UN 20% (contenedor)
  return (
    <motion.div
      className="p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Mantiene el encabezado con la fuente actual (text-xl) */}
      <h2 className="text-xl font-bold mb-3 text-red-600">
        Administración de Equipos (Serializados)
      </h2>
      <p className="text-gray-600 mb-4 text-xs">
        Mapea Inventarios serializados importados en tiempo real desde SAP.
        Gestiona el ciclo de vida completo de equipos serializados
        (decodificadores, routers, modems, etc.), desde la recepción hasta la
        instalación o RMA.
      </p>

      {/* APLICACIÓN DEL COMPACTSTYLE='SERIAL' para la reducción adicional del 10% en la data Y AHORA EN EL ENCABEZADO */}
      <InventoryTable
        data={serializados}
        columns={serialColumns}
        title="Lista de Equipos Serializados (Ejemplo)"
        filterableAccessors={filterableColumns}
        compactStyle="serial"
      />
    </motion.div>
  );
}

/**
 * --- MODAL para Agregar Nuevo Serial (Logística) ---
 */
function AddSerialModal({ serial, onClose, onSubmit }) {
  // Usamos las listas extendidas para los MOCKS
  const tiposEquipoLocal = tiposEquipo;
  const tecnologiasLocal = tecnologias;
  const ubicacionesLocal = ubicacionesBodega;

  const [formData, setFormData] = useState({
    serial: serial,
    tipo: "",
    tecnologia: tecnologiasLocal[0], // Default
    ubicacion: ubicacionesLocal[0], // Default
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.tipo || !formData.tecnologia) {
      alert("Por favor, complete el Tipo de Equipo y la Tecnología.");
      return;
    }
    onSubmit(formData);
    onClose();
  };

  // TAMAÑO REDUCIDO EN UN 20%
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        className="bg-white rounded-lg shadow-2xl w-full max-w-sm"
      >
        <div className="p-3 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-bold text-red-600 flex items-center gap-1.5">
            <Plus size={16} /> Registrar Nuevo Serial: {serial}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-0.5"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 space-y-2.5">
          {/* Campo Serial (No editable) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">
              Serial
            </label>
            <input
              type="text"
              value={formData.serial}
              readOnly
              className="w-full p-2 border border-gray-200 bg-gray-50 rounded-md text-sm font-semibold"
            />
          </div>

          {/* Tipo de Equipo (Dropdown) */}
          <div>
            <label
              htmlFor="tipo"
              className="block text-xs font-medium text-gray-700 mb-0.5"
            >
              Tipo de Equipo *
            </label>
            <select
              id="tipo"
              name="tipo"
              value={formData.tipo}
              onChange={handleInputChange}
              required
              className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500 transition"
            >
              <option value="">Seleccione el tipo...</option>
              {tiposEquipoLocal.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Tecnología (Dropdown) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="tecnologia"
                className="block text-xs font-medium text-gray-700 mb-0.5"
              >
                Tecnología *
              </label>
              <select
                id="tecnologia"
                name="tecnologia"
                value={formData.tecnologia}
                onChange={handleInputChange}
                required
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500 transition"
              >
                {tecnologiasLocal.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Ubicación (Dropdown) */}
            <div>
              <label
                htmlFor="ubicacion"
                className="block text-xs font-medium text-gray-700 mb-0.5"
              >
                Ubicación (Bodega) *
              </label>
              <select
                id="ubicacion"
                name="ubicacion"
                value={formData.ubicacion}
                onChange={handleInputChange}
                required
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500 transition"
              >
                {ubicacionesLocal.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <p className="mt-0.5 text-[10px] text-gray-500">
                Quedará como "Disponible en Bodega"
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 text-sm font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition mr-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-2.5 py-1.5 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 transition flex items-center gap-1.5"
            >
              <Database size={14} /> Guardar y Registrar
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// -------------------------------------------------------------------------

/**
 * --- COMPONENTE: Pestaña de Asignación de Inventario al Técnico ---
 */
function AsignacionInventarioTecnico() {
  const { showToast, showActionToast } = useToast();
  const { assignSerialToTech, addNewSerial } = useInventory();
  const [serialInput, setSerialInput] = useState("");

  // Usamos la lista de técnicos extendida para el default
  const firstTechId = tecnicos[0].id;
  const [selectedTech, setSelectedTech] = useState(firstTechId);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddSerialModal, setShowAddSerialModal] = useState(false);
  const [serialToRegister, setSerialToRegister] = useState("");

  // Obtener la lista única de técnicos para el dropdown (usando el mock extendido de técnicos)
  const availableTechnicians = tecnicos;

  // Obtener el nombre del técnico seleccionado
  const selectedTechInfo =
    availableTechnicians.find((t) => t.id === selectedTech) || {};

  const handleAssign = (e) => {
    e.preventDefault();
    const serial = serialInput.trim().toUpperCase();

    if (!serial) {
      showToast("Por favor, ingrese un número de serial.", "error");
      return;
    }

    if (!selectedTech) {
      showToast("Por favor, seleccione un técnico.", "error");
      return;
    }

    setIsProcessing(true);
    setSerialToRegister(serial); // Guardar el serial para el modal

    // Simulación de escaneo y asignación
    setTimeout(() => {
      const result = assignSerialToTech(
        serial,
        selectedTech,
        selectedTechInfo.nombre
      );

      if (result.success) {
        showToast(result.message, "success");
      } else if (result.code === "NOT_FOUND") {
        // Serial no encontrado: Mostrar Toast con acción
        showActionToast(
          result.message + " ¿Desea registrarlo en el inventario maestro?",
          "error",
          "Registrar Serial",
          () => {
            setShowAddSerialModal(true);
          }
        );
      } else {
        // Serial encontrado pero no disponible
        showToast(result.message, "error");
      }

      setSerialInput("");
      setIsProcessing(false);
    }, 800);
  };

  const handleAddSerialSubmit = (data) => {
    const result = addNewSerial(data);
    if (result.success) {
      showToast(result.message, "success");
    } else {
      showToast(result.message, "error");
    }
  };

  // TAMAÑO REDUCIDO EN UN 20%
  return (
    <>
      <div className="bg-white p-4 rounded-lg shadow-lg mt-4 border-l-4 border-red-600">
        <h3 className="text-base font-bold text-gray-800 mb-2 flex items-center gap-1.5">
          <Scan className="w-4 h-4 text-red-600" /> Asignación Rápida de
          Inventario a Técnico
        </h3>
        <p className="text-gray-600 mb-3 text-xs">
          Utilice esta sección para transferir equipos serializados (simulando
          una pistola de código de barras) desde la Bodega Central al inventario
          del técnico.
        </p>

        <form
          onSubmit={handleAssign}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end"
        >
          {/* 1. Selector de Técnico */}
          <div className="sm:col-span-1">
            <label
              htmlFor="tech-select"
              className="block text-xs font-medium text-gray-700 mb-0.5"
            >
              Técnico Destino
            </label>
            <select
              id="tech-select"
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition"
              disabled={isProcessing}
            >
              {availableTechnicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.nombre} ({tech.id})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Entrada de Serial (Escaneo) */}
          <div className="sm:col-span-2">
            <label
              htmlFor="serial-input"
              className="block text-xs font-medium text-gray-700 mb-0.5"
            >
              Serial a Asignar (Simular Escaneo)
            </label>
            <input
              id="serial-input"
              type="text"
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value)}
              placeholder="Ej: RTR112233445"
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition uppercase"
              disabled={isProcessing}
            />
          </div>

          {/* 3. Botón de Asignación */}
          <button
            type="submit"
            className="sm:col-span-1 bg-green-600 text-white py-2 rounded-md font-bold hover:bg-green-700 transition duration-300 flex items-center justify-center gap-1.5 disabled:bg-green-400 text-sm"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Truck size={16} />
            )}
            {isProcessing ? "Asignando..." : "Asignar a Técnico"}
          </button>
        </form>
      </div>

      {/* Modal de Registro de Serial (Se muestra si el serial no existe) */}
      <AnimatePresence>
        {showAddSerialModal && serialToRegister && (
          <AddSerialModal
            serial={serialToRegister}
            onClose={() => setShowAddSerialModal(false)}
            onSubmit={handleAddSerialSubmit}
          />
        )}
      </AnimatePresence>
    </>
  );
}
// -------------------------------------------------------------------------

function OperacionesClaro() {
  const { serializados } = useInventory();

  const assignmentColumns = [
    { header: "Serial", accessor: "serial" },
    { header: "Tipo de Equipo", accessor: "tipo" },
    { header: "Asignado a ID", accessor: "tecnicoId" },
    { header: "Técnico/Cliente", accessor: "tecnicoNombre" },
    { header: "Ubicación Actual", accessor: "ubicacion" },
  ];

  // Filtra equipos que están asignados a alguien o instalados en un cliente
  const assignedEquipment = serializados.filter(
    (e) => e.tecnicoId || e.ubicacion.includes("Cliente")
  );

  // Columnas que queremos filtrar en esta pantalla
  const filterableColumns = ["tipo", "tecnicoId", "tecnicoNombre", "ubicacion"];

  // TAMAÑO REDUCIDO EN UN 20%
  return (
    <motion.div
      className="p-5 space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-xl font-bold mb-3 text-red-600">
        Operaciones Logísticas y Flujos
      </h2>
      <p className="text-gray-600 mb-4 text-xs">
        Visualización de movimientos de inventario: asignación a técnicos de
        campo y consumo final en órdenes de servicio.
      </p>

      {/* --- Pestaña de Asignación Rápida (Componente reducido) --- */}
      <AsignacionInventarioTecnico />
      {/* --------------------------------------------------------- */}

      <InventoryTable
        data={assignedEquipment}
        columns={assignmentColumns}
        title="Equipos Asignados o Instalados (Serializados)"
        filterableAccessors={filterableColumns}
        compactStyle="default" // Usa el estilo base reducido
      />

      <div className="bg-red-50 p-3 rounded-md mt-3 border-l-4 border-red-400">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">
          Consumo de Materiales No Serializados
        </h3>
        <p className="text-xs text-gray-600">
          Los materiales (ej. Cable, Fibra) se consumen por cantidad y se
          reflejan en el stock de la bodega del técnico tras la finalización de
          la orden de servicio. No se rastrean por unidad individual aquí. (Ver
          Catálogo de Materiales)
        </p>
      </div>
    </motion.div>
  );
}

function IntegracionClaro() {
  const { consumoDiario } = useInventory();
  // Eliminamos los estados de sincronización manual (isSyncingOFSC, isSyncingSAP)

  const consumoColumns = [
    { header: "ID Técnico", accessor: "tecnicoId" },
    { header: "Nombre", accessor: "nombre" },
    { header: "Fecha Consolidado", accessor: "fecha" },
    { header: "Equipos Instalados", accessor: "equiposInstalados" },
    {
      header: "Materiales (Unidades)",
      accessor: "materialesConsumidos",
    },
    // Descripción de estado actualizada para reflejar el flujo automático
    { header: "Estado (OFSC/SAP)", accessor: "estadoSincro" },
  ];

  // Columnas que queremos filtrar en esta pantalla
  const filterableColumns = ["tecnicoId", "nombre", "fecha", "estadoSincro"];

  // TAMAÑO REDUCIDO EN UN 20%
  return (
    <motion.div
      className="p-5 space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-xl font-bold text-red-600">
        Integración y Campo (OFSC & SAP)
      </h2>
      <p className="text-gray-600 text-xs mb-4">
        Monitoreo del flujo de datos (Automático) de consumo: la actividad del
        técnico en OFSC se consolida una vez cerrada y se envía en línea a SAP.
        Esta tabla muestra el estado de esa validación y envío.
      </p>

      {/* Eliminamos el div con los botones de sincronización */}
      <div className="p-3 bg-green-100 border-l-4 border-green-400 rounded-md">
        <p className="text-xs text-gray-700 font-semibold flex items-center gap-1.5">
          <CheckCircle size={14} className="text-green-600" />
          Flujo de Consumo: El proceso de sincronización OFSC y envío a SAP se
          ejecuta (Automáticamente y en línea) al completar la orden de
          servicio.
        </p>
      </div>

      {/* APLICACIÓN DEL COMPACTSTYLE='SERIAL' para la reducción adicional del 10% en la data Y EL ENCABEZADO */}
      <InventoryTable
        data={consumoDiario}
        columns={consumoColumns}
        title="Consolidado de Consumo Diario (Actualización Automática)"
        filterableAccessors={filterableColumns}
        compactStyle="serial" // <--- USA EL ESTILO SERIAL CON ENCABEZADO Y DATA REDUCIDOS
      />
    </motion.div>
  );
}

/**
 * --- COMPONENTE: Registro Rápido RMA ---
 */
function RegistroRmaRapido() {
  const { showToast, registerRMA } = useInventory();
  // Usamos la lista de técnicos extendida
  const availableTechnicians = tecnicos;
  const causalesRMA = MOCK_CAUSALES_RMA;

  const [serialInput, setSerialInput] = useState("");
  const [selectedTech, setSelectedTech] = useState(availableTechnicians[0].id);
  const [selectedCausal, setSelectedCausal] = useState(causalesRMA[0]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Obtener el nombre del técnico seleccionado
  const selectedTechInfo =
    availableTechnicians.find((t) => t.id === selectedTech) || {};

  const handleRegisterRMA = (e) => {
    e.preventDefault();
    const serial = serialInput.trim().toUpperCase();

    if (!serial || !selectedTech || !selectedCausal) {
      showToast(
        "Por favor, complete el Serial, el Técnico y la Causal.",
        "error"
      );
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      const result = registerRMA({
        serial: serial,
        causal: selectedCausal,
        tecnicoId: selectedTech,
        nombreTecnico: selectedTechInfo.nombre,
      });

      if (result.success) {
        showToast(result.message, "success");
      } else {
        showToast(result.message, "error");
      }

      setSerialInput("");
      setIsProcessing(false);
    }, 800);
  };

  // TAMAÑO REDUCIDO EN UN 20%
  return (
    <div className="bg-white p-4 rounded-lg shadow-lg border-l-4 border-purple-600">
      <h3 className="text-base font-bold text-gray-800 mb-2 flex items-center gap-1.5">
        <Archive className="w-4 h-4 text-purple-600" /> Registro Rápido de
        Inventario en RMA
      </h3>
      <p className="text-gray-600 mb-3 text-xs">
        Utilice esta sección para registrar un equipo devuelto por el técnico al
        almacén de RMA/Dañados, capturando la causal principal.
      </p>

      <form
        onSubmit={handleRegisterRMA}
        className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end"
      >
        {/* 1. Selector de Técnico */}
        <div>
          <label
            htmlFor="tech-select-rma"
            className="block text-xs font-medium text-gray-700 mb-0.5"
          >
            Técnico que Reporta
          </label>
          <select
            id="tech-select-rma"
            value={selectedTech}
            onChange={(e) => setSelectedTech(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            disabled={isProcessing}
          >
            {availableTechnicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.nombre} ({tech.id})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Entrada de Serial */}
        <div>
          <label
            htmlFor="serial-input-rma"
            className="block text-xs font-medium text-gray-700 mb-0.5"
          >
            Serial de Equipo (Reportado)
          </label>
          <input
            id="serial-input-rma"
            type="text"
            value={serialInput}
            onChange={(e) => setSerialInput(e.target.value)}
            placeholder="Ej: DEC987654321"
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition uppercase"
            disabled={isProcessing}
          />
        </div>

        {/* 3. Causal Reportada */}
        <div>
          <label
            htmlFor="causal-select"
            className="block text-xs font-medium text-gray-700 mb-0.5"
          >
            Causal Reportada
          </label>
          <select
            id="causal-select"
            value={selectedCausal}
            onChange={(e) => setSelectedCausal(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            disabled={isProcessing}
          >
            {causalesRMA.map((causal) => (
              <option key={causal} value={causal}>
                {causal}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Botón de Registro */}
        <button
          type="submit"
          className="bg-purple-600 text-white py-2 rounded-md font-bold hover:bg-purple-700 transition duration-300 flex items-center justify-center gap-1.5 disabled:bg-purple-400 text-sm"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <AlertTriangle size={16} />
          )}
          {isProcessing ? "Registrando..." : "Registrar RMA"}
        </button>
      </form>
    </div>
  );
}

// -------------------------------------------------------------------------

function RMAClaro() {
  const { rmaEquipos } = useInventory();

  const rmaColumns = [
    { header: "Serial", accessor: "serial" },
    { header: "Tipo de Equipo", accessor: "tipo" },
    { header: "Estado", accessor: "estado" },
    { header: "Causal de Ingreso", accessor: "causal" },
    { header: "Técnico Reporta", accessor: "nombreTecnico" },
    { header: "Fecha Registro", accessor: "fechaRegistro" },
  ];

  // Añadimos 'tecnicoReporta' y 'nombreTecnico' a los filtros
  const filterableColumns = [
    "tipo",
    "estado",
    "causal",
    "tecnicoReporta",
    "nombreTecnico",
    "fechaRegistro",
  ];

  // TAMAÑO REDUCIDO EN UN 20%
  return (
    <motion.div
      className="p-5 space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-xl font-bold mb-3 text-red-600">
        Gestión de RMA y Equipos Dañados
      </h2>
      <p className="text-gray-600 mb-4 text-xs">
        Control de equipos que han sido devueltos (RMA) o que han sido dados de
        baja por daño físico o funcional. Permite el monitoreo de los procesos
        de reparación y disposición final.
      </p>

      {/* --- Nuevo Componente de Registro Rápido RMA (Componente reducido) --- */}
      <RegistroRmaRapido />
      {/* -------------------------------------------------------------------- */}

      <InventoryTable
        data={rmaEquipos}
        columns={rmaColumns}
        title="Equipos en Proceso RMA / Dañado"
        filterableAccessors={filterableColumns}
        compactStyle="default" // Usa el estilo base reducido
      />
    </motion.div>
  );
}

function TecnologiaServiciosClaro() {
  const { showToast } = useToast();
  // Usamos el mock inicial y un estado para las ediciones
  const [editedServices, setEditedServices] = useState(
    MOCK_TECNOLOGIA_SERVICIOS
  );
  const [expandedTech, setExpandedTech] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  // Estado para el formulario de adición/eliminación
  const [newService, setNewService] = useState({
    tecnologia: editedServices[0].tecnologia, // HFC por defecto
    codigo: "",
    nombre: "",
    tipo: "",
  });

  const toggleExpand = (tecnologia) => {
    setExpandedTech(expandedTech === tecnologia ? null : tecnologia);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewService((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddService = () => {
    if (
      !newService.codigo ||
      !newService.nombre ||
      !newService.tipo ||
      !newService.tecnologia
    ) {
      showToast(
        "Todos los campos del nuevo servicio son obligatorios.",
        "error"
      );
      return;
    }

    setEditedServices((prev) =>
      prev.map((tech) => {
        if (tech.tecnologia === newService.tecnologia) {
          // Evitar duplicados
          if (
            tech.servicios_compatibles.some(
              (s) => s.codigo === newService.codigo
            )
          ) {
            showToast(
              `El código de servicio ${newService.codigo} ya existe para ${newService.tecnologia}.`,
              "error"
            );
            return tech;
          }
          return {
            ...tech,
            servicios_compatibles: [
              ...tech.servicios_compatibles,
              {
                codigo: newService.codigo.toUpperCase(),
                nombre: newService.nombre,
                tipo: newService.tipo,
              },
            ],
          };
        }
        return tech;
      })
    );

    showToast(
      `Servicio ${newService.codigo} agregado a ${newService.tecnologia}.`,
      "success"
    );
    setNewService({
      tecnologia: newService.tecnologia,
      codigo: "",
      nombre: "",
      tipo: "",
    });
  };

  const handleRemoveService = (tecnologia, codigo) => {
    setEditedServices((prev) =>
      prev.map((tech) => {
        if (tech.tecnologia === tecnologia) {
          return {
            ...tech,
            servicios_compatibles: tech.servicios_compatibles.filter(
              (s) => s.codigo !== codigo
            ),
          };
        }
        return tech;
      })
    );
    showToast(`Servicio ${codigo} eliminado de ${tecnologia}.`, "success");
  };

  const techColumns = [
    { header: "Tecnología", accessor: "tecnologia" },
    { header: "Descripción", accessor: "descripcion" },
    { header: "Acción", accessor: "accion" },
  ];

  const filterableColumns = ["tecnologia"];

  // Función para renderizar el contenido expansible de servicios
  const renderServices = (item) => {
    if (expandedTech !== item.tecnologia) return null;

    // TAMAÑO REDUCIDO EN UN 20%
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="bg-gray-100 p-2.5 border-t border-gray-200"
      >
        <h4 className="font-semibold text-sm text-gray-700 mb-1.5 border-b pb-1 flex items-center justify-between">
          Servicios Compatibles ({item.servicios_compatibles.length})
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 text-xs">
          {item.servicios_compatibles.map((servicio, index) => (
            <div
              key={index}
              className={`p-2 bg-white rounded-md border shadow-sm flex flex-col ${
                showEditor ? "border-red-200" : "border-gray-200"
              }`}
            >
              <span className="font-bold text-red-600 text-xs">
                {servicio.codigo}
              </span>
              <span className="text-gray-800 text-[11px]">
                {servicio.nombre}
              </span>
              <span className="text-gray-500 italic mt-0.5 text-[9px]">
                Tipo: {servicio.tipo}
              </span>
              {showEditor && (
                <button
                  onClick={() =>
                    handleRemoveService(item.tecnologia, servicio.codigo)
                  }
                  className="mt-1 text-[10px] text-red-600 hover:text-red-800 flex items-center gap-0.5 font-medium self-end"
                >
                  <Minus size={10} /> Quitar
                </button>
              )}
            </div>
          ))}
          {item.servicios_compatibles.length === 0 && (
            <span className="text-gray-500 italic col-span-3 text-xs">
              No hay servicios compatibles definidos.
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  // Modificar los datos para incluir la columna de acción
  const dataWithAction = editedServices.map((item) => ({
    ...item,
    accion: () => (
      <button
        onClick={() => toggleExpand(item.tecnologia)}
        className="text-blue-600 hover:text-blue-800 font-semibold text-xs underline"
      >
        {expandedTech === item.tecnologia
          ? "Ocultar Servicios"
          : "Ver Servicios"}
      </button>
    ),
  }));

  // TAMAÑO REDUCIDO EN UN 20%
  return (
    <motion.div
      className="p-5 space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-bold text-red-600">
          Mapeo de Tecnología y Servicios
        </h2>
        <button
          onClick={() => setShowEditor(!showEditor)}
          className={`px-3 py-1.5 rounded-md font-semibold transition duration-300 flex items-center gap-1.5 text-xs ${
            showEditor
              ? "bg-gray-700 text-white hover:bg-gray-800"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          <Edit size={14} />
          {showEditor ? "Ocultar Administrador" : "Administrar Servicios"}
        </button>
      </div>

      <p className="text-gray-600 mb-4 text-xs">
        Esta matriz define qué servicios comerciales son compatibles con cada
        tecnología de acceso.
      </p>

      {/* --- Pestaña de Administración/Editor --- */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 mb-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm overflow-hidden"
          >
            <h3 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-1.5">
              <Plus size={14} /> Agregar Nuevo Servicio Compatible
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              {/* Selector de Tecnología */}
              <select
                name="tecnologia"
                value={newService.tecnologia}
                onChange={handleInputChange}
                className="p-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 text-xs md:col-span-1"
              >
                {editedServices.map((tech) => (
                  <option key={tech.tecnologia} value={tech.tecnologia}>
                    {tech.tecnologia}
                  </option>
                ))}
              </select>
              {/* Código */}
              <input
                type="text"
                name="codigo"
                placeholder="Código (Ej: INT_100)"
                value={newService.codigo}
                onChange={handleInputChange}
                className="p-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 text-xs md:col-span-1"
              />
              {/* Nombre */}
              <input
                type="text"
                name="nombre"
                placeholder="Nombre (Ej: Internet Fibra 100 Mbps)"
                value={newService.nombre}
                onChange={handleInputChange}
                className="p-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 text-xs md:col-span-1"
              />
              {/* Tipo */}
              <select
                name="tipo"
                value={newService.tipo}
                onChange={handleInputChange}
                className="p-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 text-xs md:col-span-1"
              >
                <option value="" disabled>
                  Seleccionar Tipo
                </option>
                <option value="Internet">Internet</option>
                <option value="TV">TV</option>
                <option value="Telefonía">Telefonía</option>
                <option value="Bundle">Bundle (Paquete)</option>
                <option value="Móvil">Móvil</option>
              </select>

              <button
                onClick={handleAddService}
                className="bg-red-600 text-white py-2 rounded-md font-bold hover:bg-red-700 transition duration-200 flex items-center justify-center gap-1.5 text-xs md:col-span-1"
              >
                <Plus size={14} /> Agregar
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-red-700">
              *Los servicios se agregan inmediatamente al mapeo y se pueden
              quitar usando el botón "Quitar" al expandir la fila.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      {/* --- FIN PESTAÑA EDITOR --- */}

      <InventoryTable
        data={dataWithAction}
        columns={techColumns}
        title="Matriz de Compatibilidad: Tecnología vs. Código de Servicio"
        renderExpansibleContent={renderServices}
        filterableAccessors={filterableColumns}
        compactStyle="default" // Usa el estilo base reducido
      />

      <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-md">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">
          Uso en Logística
        </h3>
        <p className="text-xs text-gray-600">
          La tecnología de la orden de servicio (ej. **Fibra Óptica**) dicta el
          tipo de equipo que el técnico puede consumir de su inventario (ej.
          **Modem Fibra GPON**), garantizando la integridad de la instalación.
        </p>
      </div>
    </motion.div>
  );
}

// --- APP PRINCIPAL ---

function PrivateRoutes() {
  const { loggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loggedIn) {
      // Redirige a /login, pero guarda la ubicación actual para volver si es necesario
      navigate("/login", { replace: true, state: { from: location } });
    }
  }, [loggedIn, navigate, location]);

  // Si no está logueado, retorna null para evitar renderizar contenido privado brevemente
  if (!loggedIn) return null;

  return (
    <div className="flex h-screen bg-gray-100">
      <SidebarClaro />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <HeaderClaro />
        <main className="flex-1">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<HomeClaro />} />
              <Route path="/catalogo" element={<CatalogoClaro />} />
              <Route path="/seriales" element={<SerialesClaro />} />
              <Route path="/operaciones" element={<OperacionesClaro />} />
              <Route path="/integracion" element={<IntegracionClaro />} />
              <Route path="/rma" element={<RMAClaro />} />
              <Route
                path="/tecnologia-servicios"
                element={<TecnologiaServiciosClaro />}
              />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    // Se usa MemoryRouter para simular el enrutamiento en un entorno aislado como este
    <Router>
      <ToastProvider>
        <AuthProvider>
          <InventoryProvider>
            <Routes>
              <Route path="/login" element={<LoginClaro />} />
              <Route path="*" element={<PrivateRoutes />} />
            </Routes>
          </InventoryProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
