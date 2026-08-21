import { sql, SQL } from "drizzle-orm";
import { dataAttributes } from "../../drizzle/schema.js";

export type QualityCondition = {
  field: string;
  operator: "isNotNull" | "isNull" | "regex" | "equals" | "notEquals" | "isTrue" | "isFalse";
  value?: string;
};

export class RuleEngine {
  static compileCondition(condition: QualityCondition): SQL | null {
    let column: any;
    switch(condition.field) {
      case "description": column = dataAttributes.description; break;
      case "dataType": column = dataAttributes.dataType; break;
      case "isPii": column = dataAttributes.isPii; break;
      case "isVerified": column = dataAttributes.isVerified; break;
      case "businessRules": column = dataAttributes.businessRules; break;
      case "name": column = dataAttributes.name; break;
      default: return null; // Unrecognized field
    }

    switch(condition.operator) {
      case "isNotNull":
        return sql`(${column} IS NOT NULL AND TRIM(CAST(${column} AS TEXT)) != '')`;
      case "isNull":
        return sql`(${column} IS NULL OR TRIM(CAST(${column} AS TEXT)) = '')`;
      case "isTrue":
        return sql`${column} = TRUE`;
      case "isFalse":
        return sql`${column} = FALSE`;
      case "equals":
        return sql`${column} = ${condition.value}`;
      case "notEquals":
        return sql`${column} != ${condition.value}`;
      case "regex":
        return sql`${column} ~* ${condition.value}`; // Postgres regex
      default:
        return null;
    }
  }

  static parseExpression(expressionJson: any): SQL | null {
    if (!expressionJson) return null;
    
    // Fallback simple condition
    if (expressionJson.operator && expressionJson.field) {
      return this.compileCondition(expressionJson as QualityCondition);
    }
    
    // Future: Handle nested AND / OR operators
    if (expressionJson.and && Array.isArray(expressionJson.and)) {
      const conditions = expressionJson.and.map((c: any) => this.parseExpression(c)).filter(Boolean);
      if (conditions.length === 0) return null;
      return sql`(${sql.join(conditions, sql` AND `)})`;
    }
    
    if (expressionJson.or && Array.isArray(expressionJson.or)) {
      const conditions = expressionJson.or.map((c: any) => this.parseExpression(c)).filter(Boolean);
      if (conditions.length === 0) return null;
      return sql`(${sql.join(conditions, sql` OR `)})`;
    }

    return null;
  }
}
