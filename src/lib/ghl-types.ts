// Tipos que reflejan la estructura real de datos de GHL MCP

export interface GHLPipeline {
  id: string;
  name: string;
  stages: GHLStage[];
}

export interface GHLStage {
  id: string;
  name: string;
  position: number;
  stageWinProbability: number;
}

export interface GHLConversation {
  id: string;
  contactId: string;
  contactName: string;
  email?: string;
  phone?: string;
  lastMessageDate: number;
  lastMessageType: ConversationType;
  lastMessageBody: string;
  lastMessageDirection: 'inbound' | 'outbound';
  unreadCount: number;
  assignedTo?: string;
  tags: string[];
  scoring?: { id: string; score: number }[];
}

export type ConversationType =
  | 'TYPE_SMS'
  | 'TYPE_EMAIL'
  | 'TYPE_CALL'
  | 'TYPE_FACEBOOK'
  | 'TYPE_INSTAGRAM'
  | 'TYPE_WHATSAPP'
  | 'TYPE_LIVE_CHAT';

export interface GHLOpportunity {
  id: string;
  name: string;
  contactId: string;
  contactName: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  assignedTo?: string;
  dateAdded: string;
}

// Tipos para el dashboard (derivados del análisis)

export interface RevenueLeakSummary {
  totalEstimatedValue: number;
  closedWonValue: number;
  lostValue: number;
  recoverableValue: number;
  conversionRate: number;
  totalConversations: number;
  wonConversations: number;
  lostConversations: number;
}

export interface LossPhase {
  phase: string;
  count: number;
  value: number;
}

export interface LossReason {
  reason: string;
  count: number;
  value: number;
  percentage: number;
}

export interface RecoverableTicket {
  id: string;
  contactName: string;
  channel: 'WhatsApp' | 'Email' | 'SMS' | 'Facebook' | 'Instagram' | 'Llamada';
  date: string;
  value: number;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  lossReason: string;
  stage: string;
  score: number;
  lastContact: string;
  email?: string;
  phone?: string;
  description?: string;
  draftSubject?: string;
  draftMessage?: string;
  draftStatus?: 'draft' | 'approved' | 'sent' | 'failed' | 'awaiting_response' | 'replied_positive' | 'replied_negative' | 'replied_neutral' | 'no_response' | 'followup_sent' | 'archived';
}

export interface CampaignMetric {
  id: string;
  name: string;
  status: 'active' | 'scheduled' | 'completed' | 'draft' | 'archived';
  waveNumber?: number;
  messagesSent: number;
  totalValue?: number;
  responseRate: number;
  conversions: number;
  valueRecovered: number;
  repliedCount?: number;
  positiveCount?: number;
  negativeCount?: number;
  noResponseCount?: number;
  awaitingCount?: number;
  followupCount?: number;
}

export interface LossTrendMonth {
  month: string;
  lostValue: number;
  lostCount: number;
  topReason: string;
}

export interface DashboardData {
  summary: RevenueLeakSummary;
  lossByPhase: LossPhase[];
  lossByReason: LossReason[];
  recoverableTickets: RecoverableTicket[];
  campaigns: CampaignMetric[];
  pipelineName: string;
  liveRisks?: LiveOpportunityRisk[];
  wonPatterns?: WonTrackPattern[];
  lossTrends?: LossTrendMonth[];
}

export interface LiveOpportunityRisk {
  contactName: string;
  value: number;
  riskScore: number;
  warnings: string[];
  recommendedAction: string;
  assignedTo?: string;
}

export interface WonTrackPattern {
  dealType: string;
  avgTimeToCloseDays: number;
  keySuccessFactors: string[];
  commonBuyingSignals: string[];
}

export interface ForensicsApiResponse {
  batchResult: {
    analyzedAt: string;
    pipelineId: string;
    pipelineName: string;
    totalAnalyzed: number;
    summary: {
      totalValue: number;
      recoverableValue: number;
      highPriorityCount: number;
      urgentCount: number;
      avgRecoverabilityScore: number;
      topLossReasons: Array<{ reason: string; count: number; value: number }>;
      lossByStage: Array<{ stage: string; count: number; value: number }>;
    };
    conversations: Array<{
      conversationId: string;
      contactName: string;
      opportunityValue: number;
      channel: string;
      intentSignals: {
        purchaseIntent: boolean;
        signals: string[];
        score: number;
        keyPhrases: string[];
      };
      stageClassification: {
        detectedStage: string;
        confidence: number;
        evidence: string[];
        ghlStage: string;
      };
      abandonment: {
        isAbandoned: boolean;
        daysSinceLastContact: number;
        lastInboundDate: string | null;
        lastOutboundDate: string | null;
        direction: string;
      };
      lossReason: {
        primaryReason: string;
        secondaryReasons: string[];
        confidence: number;
        evidence: string[];
        suggestedAction: string;
      };
      recoverability: {
        totalScore: number;
        valueScore: number;
        recencyScore: number;
        intentScore: number;
        engagementScore: number;
        priority: string;
        factors: string[];
      };
    }>;
  };
}
