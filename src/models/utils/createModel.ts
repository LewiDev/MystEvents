// src/models/utils/createModel.ts
import mongoose from "mongoose";

export function createModel<T>(name: string, schema: mongoose.Schema<T>) {
  return (mongoose.models[name] as mongoose.Model<T>) || mongoose.model<T>(name, schema);
}
