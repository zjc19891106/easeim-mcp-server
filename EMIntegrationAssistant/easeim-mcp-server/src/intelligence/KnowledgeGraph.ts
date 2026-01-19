import { ClassRegistry } from './ClassRegistry.js';

export interface ScenarioSolution {
  id: string;
  scenario: string;
  description: string;
  keywords: string[];
  steps: string[];
  relatedClasses: string[];
  relatedApis: string[];
  relatedConfigs: string[];
  codeTemplate: string;
  tips: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ClassInfo {
  name: string;
  description: string;
  superclass: string | null;
  protocols: string[];
  isOpen: boolean;
  file: string;
  keyMethods: string[];
  keyProperties: string[];
  usageScenarios: string[];
}

export interface RelatedItems {
  classes: string[];
  apis: string[];
  configs: string[];
  guides: string[];
  scenarios: string[];
}

export class KnowledgeGraph {
  private classRegistry: ClassRegistry;

  constructor() {
    this.classRegistry = new ClassRegistry();
  }

  getClassInfo(className: string): ClassInfo | null {
    return this.classRegistry.getClassInfo(className);
  }

  getSubclasses(className: string): string[] {
    return this.classRegistry.getSubclasses(className);
  }

  getInheritanceChain(className: string): string[] {
    return this.classRegistry.getInheritanceChain(className);
  }
}
