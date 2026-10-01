import projectContent from "../../content/projects.json";
import { validateProjects } from "../schema/content";

export const projects = validateProjects(projectContent);
