import { buildTechItemsFromNames, serializeTechSection } from '@/lib/tech-serializer';
import type { ReadmeSection, TechSectionData } from '@/types/readme';

export type StudioBlockPreset = {
  id: string;
  label: string;
  description: string;
  createSection: (lang: 'pt-BR' | 'en') => ReadmeSection;
};

export const STUDIO_BLOCK_PRESETS: StudioBlockPreset[] = [
  {
    id: 'heading',
    label: 'Título & Descrição',
    description: 'Cabeçalho centralizado com subtítulo',
    createSection: (lang) => ({
      id: `heading-${Date.now()}`,
      title: lang === 'pt-BR' ? 'Cabeçalho' : 'Header',
      enabled: true,
      markdown:
        lang === 'pt-BR'
          ? `<div align="center">\n\n# Meu Projeto\n\nDescrição curta e objetiva do que o projeto faz.\n\n</div>`
          : `<div align="center">\n\n# My Project\n\nShort and clear description of what this project does.\n\n</div>`,
    }),
  },
  {
    id: 'tech_stack',
    label: 'Tech Stack & Ícones',
    description: 'Grade visual interativa de ícones (estilo original)',
    createSection: (lang) => {
      const techData: TechSectionData = {
        heading: lang === 'pt-BR' ? '## 🛠️ Tecnologias' : '## 🛠️ Tech Stack',
        align: 'left',
        height: 40,
        spacing: 12,
        icons: buildTechItemsFromNames(['typescript', 'react', 'nextjs', 'tailwindcss'], 'devicons'),
      };
      return {
        id: `techs-${Date.now()}`,
        title: lang === 'pt-BR' ? 'Tecnologias' : 'Tech Stack',
        kind: 'techs',
        techData,
        enabled: true,
        markdown: serializeTechSection(techData),
      };
    },
  },
  {
    id: 'screenshots',
    label: 'Screenshots / Demo',
    description: 'Espaço para imagens ou GIFs da interface',
    createSection: (lang) => ({
      id: `screenshots-${Date.now()}`,
      title: 'Screenshots',
      enabled: true,
      markdown:
        lang === 'pt-BR'
          ? `## 📸 Screenshots\n\n<div align="center">\n  <img src="https://via.placeholder.com/800x400?text=Preview+do+Projeto" alt="Screenshot" width="800" />\n</div>`
          : `## 📸 Screenshots\n\n<div align="center">\n  <img src="https://via.placeholder.com/800x400?text=Project+Preview" alt="Screenshot" width="800" />\n</div>`,
    }),
  },
  {
    id: 'features',
    label: 'Funcionalidades',
    description: 'Lista de recursos principais',
    createSection: (lang) => ({
      id: `features-${Date.now()}`,
      title: lang === 'pt-BR' ? 'Funcionalidades' : 'Features',
      enabled: true,
      markdown:
        lang === 'pt-BR'
          ? `## ✨ Funcionalidades\n\n- Recurso principal 1\n- Recurso principal 2\n- Integração e automação`
          : `## ✨ Features\n\n- Core feature 1\n- Core feature 2\n- Seamless integration`,
    }),
  },
  {
    id: 'stats',
    label: 'GitHub Stats',
    description: 'Cards de estatísticas e linguagens',
    createSection: (lang) => ({
      id: `stats-${Date.now()}`,
      title: 'GitHub Stats',
      enabled: true,
      markdown:
        lang === 'pt-BR'
          ? `## 📊 Estatísticas\n\n<div align="center">\n  <img height="150" src="https://github-readme-stats.vercel.app/api?username=maurodesouza&show_icons=true&theme=tokyonight" />\n</div>`
          : `## 📊 GitHub Stats\n\n<div align="center">\n  <img height="150" src="https://github-readme-stats.vercel.app/api?username=maurodesouza&show_icons=true&theme=tokyonight" />\n</div>`,
    }),
  },
  {
    id: 'socials',
    label: 'Redes & Contato',
    description: 'Badges com links para redes sociais',
    createSection: (lang) => ({
      id: `socials-${Date.now()}`,
      title: lang === 'pt-BR' ? 'Contato' : 'Contact',
      enabled: true,
      markdown:
        lang === 'pt-BR'
          ? `## 🌐 Contato\n\n[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/) [![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/)`
          : `## 🌐 Connect\n\n[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/) [![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/)`,
    }),
  },
  {
    id: 'api_endpoints',
    label: 'API / Endpoints',
    description: 'Tabela de rotas HTTP da aplicação',
    createSection: (lang) => ({
      id: `api-${Date.now()}`,
      title: 'API Endpoints',
      enabled: true,
      markdown:
        lang === 'pt-BR'
          ? `## 🔌 Endpoints da API\n\n| Método | Rota | Descrição |\n| --- | --- | --- |\n| \`GET\` | \`/api/health\` | Verifica status da API |\n| \`POST\` | \`/api/items\` | Cria um novo registro |`
          : `## 🔌 API Endpoints\n\n| Method | Route | Description |\n| --- | --- | --- |\n| \`GET\` | \`/api/health\` | Health check endpoint |\n| \`POST\` | \`/api/items\` | Create a new record |`,
    }),
  },
  {
    id: 'contributing',
    label: 'Contribuição',
    description: 'Guia rápido para colaboradores open source',
    createSection: (lang) => ({
      id: `contributing-${Date.now()}`,
      title: lang === 'pt-BR' ? 'Contribuição' : 'Contributing',
      enabled: true,
      markdown:
        lang === 'pt-BR'
          ? `## 🤝 Como Contribuir\n\n1. Faça um **Fork** do projeto\n2. Crie uma branch para sua feature (\`git checkout -b feat/nova-feature\`)\n3. Faça o commit das alterações (\`git commit -m "feat: add new feature"\`)\n4. Envie para a branch (\`git push origin feat/nova-feature\`)\n5. Abra um **Pull Request**`
          : `## 🤝 Contributing\n\n1. **Fork** the project\n2. Create your feature branch (\`git checkout -b feat/amazing-feature\`)\n3. Commit your changes (\`git commit -m "feat: add amazing feature"\`)\n4. Push to the branch (\`git push origin feat/amazing-feature\`)\n5. Open a **Pull Request**`,
    }),
  },
  {
    id: 'roadmap',
    label: 'Roadmap',
    description: 'Checklist de próximas entregas',
    createSection: () => ({
      id: `roadmap-${Date.now()}`,
      title: 'Roadmap',
      enabled: true,
      markdown: `## 🗺️ Roadmap\n\n- [x] MVP inicial\n- [ ] Novos templates visuais\n- [ ] Testes automatizados`,
    }),
  },
  {
    id: 'divider',
    label: 'Divisor (---)',
    description: 'Linha horizontal separadora',
    createSection: () => ({
      id: `divider-${Date.now()}`,
      title: 'Divisor',
      enabled: true,
      markdown: '---',
    }),
  },
];
