"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = exports.queueSizeGauge = exports.pdfGenerationDurationSeconds = exports.batchProcessingDurationSeconds = exports.documentsGeneratedTotal = void 0;
exports.startQueueSizeGauge = startQueueSizeGauge;
exports.stopQueueSizeGauge = stopQueueSizeGauge;
const promClient = __importStar(require("prom-client"));
exports.documentsGeneratedTotal = new promClient.Counter({
    name: "documents_generated_total",
    help: "Nombre total de documents générés",
    labelNames: ["status"],
    registers: [promClient.register]
});
exports.batchProcessingDurationSeconds = new promClient.Histogram({
    name: "batch_processing_duration_seconds",
    help: "Durée de traitement d'un batch (fin: completed/failed)",
    buckets: [1, 5, 10, 30, 60, 120, 300],
    registers: [promClient.register]
});
exports.pdfGenerationDurationSeconds = new promClient.Histogram({
    name: "pdf_generation_duration_seconds",
    help: "Durée de génération PDF",
    buckets: [0.1, 0.5, 1, 2, 5],
    registers: [promClient.register]
});
exports.queueSizeGauge = new promClient.Gauge({
    name: "queue_size",
    help: "Taille estimée de la queue (waiting + delayed)",
    registers: [promClient.register]
});
let gaugeInterval = null;
function startQueueSizeGauge(queue) {
    if (gaugeInterval)
        return;
    const tick = async () => {
        try {
            // waiting + delayed is a good approximation of "work not yet started"
            const counts = await queue.getJobCounts("waiting", "delayed");
            const size = (counts.waiting ?? 0) + (counts.delayed ?? 0);
            exports.queueSizeGauge.set(size);
        }
        catch {
            // Avoid crashing the API when Redis/BullMQ is temporarily unhealthy.
            exports.queueSizeGauge.set(0);
        }
    };
    void tick();
    gaugeInterval = setInterval(() => {
        void tick();
    }, 5000);
}
function stopQueueSizeGauge() {
    if (!gaugeInterval)
        return;
    clearInterval(gaugeInterval);
    gaugeInterval = null;
}
exports.register = promClient.register;
//# sourceMappingURL=prometheus.js.map