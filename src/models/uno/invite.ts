// src/models/invite.ts
import mongoose, { Schema, Types } from "mongoose";

export type InviteStatus = "PENDING" | "ACCEPTED" | "DENIED" | "EXPIRED";

export interface IInvite {
  tournamentId: Types.ObjectId;
  teamId: Types.ObjectId;      // inviter's team
  inviterId: string;           // Discord user ID
  inviteeId: string;           // Discord user ID
  status: InviteStatus;
  createdAt: Date;
  expiresAt?: Date;            // optional
}

const InviteSchema = new Schema<IInvite>(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: "Tournament", required: true, index: true },
    teamId:       { type: Schema.Types.ObjectId, ref: "Team",       required: true, index: true },
    inviterId:    { type: String, required: true, index: true },
    inviteeId:    { type: String, required: true, index: true },
    status:       { type: String, enum: ["PENDING","ACCEPTED","DENIED","EXPIRED"], default: "PENDING", index: true },
    createdAt:    { type: Date, default: () => new Date() },
    expiresAt:    { type: Date },
  },
  { versionKey: false }
);

// Optional: ensure only 1 live PENDING invite per inviter->invitee per tournament
InviteSchema.index(
  { tournamentId: 1, inviterId: 1, inviteeId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "PENDING" } }
);

export const Invite = mongoose.models.Invite ?? mongoose.model<IInvite>("Invite", InviteSchema);
