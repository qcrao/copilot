// src/data/promptTemplates.ts
import { PromptTemplate } from "../types";

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "creative-writing",
    title: "Creative Writing",
    description: "Help brainstorm and create content from current notes",
    prompt: "Based on my current notes and page content, help me create engaging content. Analyze the key themes and concepts, then suggest creative ways to develop them into articles, blog posts, or other written content. Focus on making the ideas accessible and compelling.",
    category: "writing",
    icon: "edit",
    color: "#667eea",
    requiresContext: true,
    contextType: "current-page"
  },
  {
    id: "daily-summary",
    title: "Daily Summary",
    description: "Summarize notes from a specific date",
    prompt: "Please analyze all my notes from [DATE] and provide a comprehensive summary including key points, insights, decisions made, and action items for follow-up.",
    category: "analysis",
    icon: "calendar",
    color: "#f093fb",
    requiresContext: true,
    contextType: "date-range"
  },
  {
    id: "knowledge-network",
    title: "Knowledge Network",
    description: "Find connections between current notes",
    prompt: "Analyze my current notes and identify hidden connections, patterns, and relationships between different concepts and ideas. Create a knowledge map showing how these ideas relate to each other and suggest potential areas for deeper exploration.",
    category: "analysis",
    icon: "graph",
    color: "#4facfe",
    requiresContext: true,
    contextType: "current-page"
  },
  {
    id: "task-planner",
    title: "Task Planner",
    description: "Create action plans from current notes",
    prompt: "Based on my current notes, help me create a practical action plan. Identify the main objectives, break them down into actionable tasks, set priorities, and suggest a realistic timeline. Focus on creating concrete next steps I can implement immediately.",
    category: "planning",
    icon: "timeline-events",
    color: "#fa709a",
    requiresContext: true,
    contextType: "current-page"
  },
  {
    id: "learning-review",
    title: "Learning Review",
    description: "Reflect on and consolidate learning",
    prompt: "Review my current notes and help me consolidate key learnings. Identify the main concepts I've captured, highlight important insights, spot knowledge gaps, and suggest specific next steps to deepen my understanding in these areas.",
    category: "reflection",
    icon: "learning",
    color: "#a8edea",
    requiresContext: true,
    contextType: "current-page"
  },
  {
    id: "meeting-insights",
    title: "Meeting Insights",
    description: "Extract key points from meeting notes",
    prompt: "Analyze my meeting notes and help me extract the most important information. Identify key decisions made, action items assigned, important deadlines, and follow-up tasks. Organize everything clearly with priorities and responsible parties where mentioned.",
    category: "analysis",
    icon: "people",
    color: "#ffecd2",
    requiresContext: true,
    contextType: "current-page"
  },
  {
    id: "research-assistant",
    title: "Research Assistant",
    description: "Expand research based on current notes",
    prompt: "Based on my current research notes, help me identify promising areas for further investigation. Suggest specific research questions, recommend additional topics to explore, and outline a systematic approach to expand my knowledge in this domain.",
    category: "research",
    icon: "search",
    color: "#d299c2",
    requiresContext: true,
    contextType: "current-page"
  },
  {
    id: "idea-synthesizer",
    title: "Idea Synthesizer",
    description: "Combine ideas into new insights",
    prompt: "Look at all the ideas and concepts in my current notes. Help me synthesize them by finding common threads, identifying novel combinations, and suggesting creative applications. Focus on generating fresh insights and innovative approaches from the existing material.",
    category: "writing",
    icon: "lightbulb",
    color: "#89f7fe",
    requiresContext: true,
    contextType: "current-page"
  }
];