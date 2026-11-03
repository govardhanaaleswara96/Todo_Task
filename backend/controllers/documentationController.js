import { getDocumentationCatalog, getModuleSource, getAllSource } from '../services/documentationService.js';

export function getCatalog(req, res) {
  res.json({ success: true, modules: getDocumentationCatalog() });
}

export async function getModule(req, res, next) {
  try {
    const module = await getModuleSource(req.params.moduleId);
    if (!module) return res.status(404).json({ success: false, message: 'Documentation module not found.' });
    res.json({ success: true, module });
  } catch (error) { next(error); }
}

export async function exportAll(req, res, next) {
  try { res.json({ success: true, files: await getAllSource() }); }
  catch (error) { next(error); }
}
