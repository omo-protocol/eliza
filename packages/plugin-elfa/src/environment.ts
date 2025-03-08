import type { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

const elfaConfigSchema = z.object({
    ELFA_API_KEY: z.string().min(1, "Elfa API key is required"),
});

export type ElfaConfig = z.infer<typeof elfaConfigSchema>;

export async function validateElfaConfig(runtime: IAgentRuntime): Promise<ElfaConfig> {
    try {
        const config = {
            ELFA_API_KEY: runtime.getSetting("ELFA_API_KEY"),
        };

        return elfaConfigSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Elfa configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}