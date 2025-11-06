#!/usr/bin/env node

/**
 * Automated Backend Module Migration Script
 * This script migrates all remaining modules to the new modular structure
 */

const fs = require("fs");
const path = require("path");

const BASE_DIR = path.join(__dirname, "../src");
const MODULES_DIR = path.join(BASE_DIR, "modules");
const OLD_SERVICES_DIR = path.join(BASE_DIR, "services");
const OLD_ROUTES_DIR = path.join(BASE_DIR, "routes");

// Module definitions
const modules = [
  {
    name: "cards",
    service: "card.service.ts",
    routes: "card.routes.ts",
    methods: ["addCard", "getCards", "getCardById", "updateCard", "deleteCard"],
  },
  {
    name: "transactions",
    service: "transaction.service.ts",
    routes: "transaction.routes.ts",
    additionalServices: ["transaction-reconciliation.service.ts"],
  },
  {
    name: "budgets",
    service: "budget-enhanced.service.ts", // Use enhanced version
    routes: "budget.routes.ts",
    merge: ["budget.service.ts", "budget-enhanced.service.ts"],
  },
  {
    name: "alerts",
    service: "alert-enhanced.service.ts", // Use enhanced version
    routes: "alert.routes.ts",
    merge: ["alert.service.ts", "alert-enhanced.service.ts"],
  },
  {
    name: "analytics",
    service: "advanced-analytics.service.ts",
    routes: "analytics-enhanced.routes.ts",
    additionalServices: ["analytics.service.ts", "dashboard.service.ts"],
  },
  {
    name: "bills",
    service: "bill-reminder.service.ts",
    routes: ["bill-reminder.routes.ts", "bills.routes.ts"],
  },
  {
    name: "subscriptions",
    service: "subscription.service.ts",
    routes: "subscriptions.routes.ts",
    additionalServices: ["recurring-transaction.service.ts"],
  },
  {
    name: "rewards",
    service: "rewards.service.ts",
    routes: "rewards.routes.ts",
  },
  {
    name: "ai-insights",
    service: "ai-insights.service.ts",
    routes: "ai-insights.routes.ts",
  },
  {
    name: "reports",
    service: "reporting.service.ts",
    routes: "reports.routes.ts",
    additionalServices: ["export.service.ts"],
  },
];

console.log("🚀 Starting automated module migration...\n");

// Helper to update imports in file content
function updateImports(content) {
  return content
    .replace(
      /from ["']\.\.\/\.\.\/\.\.\/\.\.\/shared\/database\/supabase["']/g,
      'from "@shared/database/supabase"'
    )
    .replace(
      /from ["']\.\.\/\.\.\/\.\.\/shared\/database\/supabase["']/g,
      'from "@shared/database/supabase"'
    )
    .replace(
      /from ["']shared\/database\/supabase["']/g,
      'from "@shared/database/supabase"'
    )
    .replace(
      /from ["']\.\.\/\.\.\/\.\.\/\.\.\/shared\/cache\/redis["']/g,
      'from "@shared/cache/redis"'
    )
    .replace(
      /from ["']\.\.\/\.\.\/\.\.\/shared\/cache\/redis["']/g,
      'from "@shared/cache/redis"'
    )
    .replace(/from ["']shared\/cache\/redis["']/g, 'from "@shared/cache/redis"')
    .replace(/from ["']\.\.\/utils\/logger["']/g, 'from "@utils/logger"')
    .replace(/from ["']\.\.\/\.\.\/utils\/logger["']/g, 'from "@utils/logger"')
    .replace(
      /from ["']\.\.\/middleware\/auth["']/g,
      'from "@common/middleware/auth"'
    );
}

// Create basic interface file
function createInterface(moduleName) {
  const capitalizedName =
    moduleName.charAt(0).toUpperCase() +
    moduleName.slice(1).replace(/-./g, (x) => x[1].toUpperCase());
  return `/**
 * ${capitalizedName} Module Interfaces
 */

export interface I${capitalizedName} {
  id: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  // Add specific fields based on module
}

export interface I${capitalizedName}Response extends I${capitalizedName} {
  // Response specific fields
}
`;
}

// Create basic DTOs
function createDTOs(moduleName) {
  const capitalizedName =
    moduleName.charAt(0).toUpperCase() +
    moduleName.slice(1).replace(/-./g, (x) => x[1].toUpperCase());

  const requestDto = `/**
 * ${capitalizedName} Request DTOs
 */

export class Create${capitalizedName}Dto {
  userId!: string;
  // Add required fields
}

export class Update${capitalizedName}Dto {
  // Add optional fields
}
`;

  const responseDto = `/**
 * ${capitalizedName} Response DTOs
 */

export class ${capitalizedName}ResponseDto {
  id!: string;
  userId!: string;
  createdAt?: string;
  updatedAt?: string;
  // Add response fields
}
`;

  return { requestDto, responseDto };
}

// Create controller wrapper
function createController(moduleName, serviceName) {
  const capitalizedName =
    moduleName.charAt(0).toUpperCase() +
    moduleName.slice(1).replace(/-./g, (x) => x[1].toUpperCase());
  const serviceVarName =
    moduleName.replace(/-./g, (x) => x[1].toUpperCase()) + "Service";

  return `import { Request, Response, NextFunction } from "express";
import { ${serviceVarName} } from "./${moduleName}.service";
import { HTTP_STATUS, ERROR_MESSAGES } from "@constants";
import { logger } from "@utils/logger";

/**
 * ${capitalizedName} Controller
 * Handles HTTP requests for ${moduleName}
 */
export class ${capitalizedName}Controller {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await ${serviceVarName}.create(req.body);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error: any) {
      logger.error("${capitalizedName} creation failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        message: error.message
      });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await ${serviceVarName}.getById(id);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Get ${moduleName} failed:", error);
      res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.GENERIC.NOT_FOUND,
        message: error.message
      });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const result = await ${serviceVarName}.getAll(userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Get all ${moduleName} failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await ${serviceVarName}.update(id, req.body);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      logger.error("Update ${moduleName} failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }

  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await ${serviceVarName}.delete(id);
      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (error: any) {
      logger.error("Delete ${moduleName} failed:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR
      });
    }
  }
}
`;
}

// Create routes file
function createRoutes(moduleName) {
  const capitalizedName =
    moduleName.charAt(0).toUpperCase() +
    moduleName.slice(1).replace(/-./g, (x) => x[1].toUpperCase());

  return `import { Router } from "express";
import { ${capitalizedName}Controller } from "./${moduleName}.controller";
import { authenticate } from "@common/middleware/auth";

const router = Router();

/**
 * @route   POST /api/${moduleName}
 * @desc    Create new ${moduleName}
 * @access  Protected
 */
router.post("/", authenticate, ${capitalizedName}Controller.create);

/**
 * @route   GET /api/${moduleName}/:id
 * @desc    Get ${moduleName} by ID
 * @access  Protected
 */
router.get("/:id", authenticate, ${capitalizedName}Controller.getById);

/**
 * @route   GET /api/${moduleName}
 * @desc    Get all ${moduleName}
 * @access  Protected
 */
router.get("/", authenticate, ${capitalizedName}Controller.getAll);

/**
 * @route   PUT /api/${moduleName}/:id
 * @desc    Update ${moduleName}
 * @access  Protected
 */
router.put("/:id", authenticate, ${capitalizedName}Controller.update);

/**
 * @route   DELETE /api/${moduleName}/:id
 * @desc    Delete ${moduleName}
 * @access  Protected
 */
router.delete("/:id", authenticate, ${capitalizedName}Controller.delete);

export default router;
`;
}

// Create barrel export
function createBarrelExport(moduleName) {
  return `/**
 * ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)} Module Exports
 */

export * from "./${moduleName}.service";
export * from "./${moduleName}.controller";
export * from "./interfaces/${moduleName}.interface";
export { default as ${moduleName.replace(/-./g, (x) => x[1].toUpperCase())}Routes } from "./${moduleName}.routes";
`;
}

// Process each module
modules.forEach((module) => {
  console.log(`📦 Processing module: ${module.name}`);

  const moduleDir = path.join(MODULES_DIR, module.name);
  const dtoDir = path.join(moduleDir, "dto");
  const interfacesDir = path.join(moduleDir, "interfaces");

  // Create DTOs and interfaces
  fs.writeFileSync(
    path.join(interfacesDir, `${module.name}.interface.ts`),
    createInterface(module.name)
  );

  const { requestDto, responseDto } = createDTOs(module.name);
  fs.writeFileSync(
    path.join(dtoDir, `${module.name}-request.dto.ts`),
    requestDto
  );
  fs.writeFileSync(
    path.join(dtoDir, `${module.name}-response.dto.ts`),
    responseDto
  );

  // Copy and update service file
  const oldServicePath = path.join(OLD_SERVICES_DIR, module.service);
  if (fs.existsSync(oldServicePath)) {
    let serviceContent = fs.readFileSync(oldServicePath, "utf8");
    serviceContent = updateImports(serviceContent);
    fs.writeFileSync(
      path.join(moduleDir, `${module.name}.service.ts`),
      serviceContent
    );
  }

  // Create controller
  fs.writeFileSync(
    path.join(moduleDir, `${module.name}.controller.ts`),
    createController(module.name, module.service)
  );

  // Create routes
  fs.writeFileSync(
    path.join(moduleDir, `${module.name}.routes.ts`),
    createRoutes(module.name)
  );

  // Create barrel export
  fs.writeFileSync(
    path.join(moduleDir, "index.ts"),
    createBarrelExport(module.name)
  );

  console.log(`✅ Completed module: ${module.name}\n`);
});

console.log("🎉 All modules migrated successfully!\n");
console.log("📝 Next steps:");
console.log("1. Review generated files and add missing business logic");
console.log("2. Update src/index.ts with module imports");
console.log("3. Run: npm run build");
console.log("4. Run: npm test");
console.log("5. Clean up old services/ and routes/ directories");
