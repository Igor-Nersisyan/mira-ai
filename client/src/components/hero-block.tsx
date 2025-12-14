import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  FileSearch, 
  TrendingDown, 
  Phone, 
  Users, 
  Zap,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

const metrics = [
  {
    icon: Clock,
    value: "24/7",
    label: "Работает без перерывов",
    description: "Mira не спит, не болеет и не уходит в отпуск",
  },
  {
    icon: FileSearch,
    value: "10 000",
    label: "Резюме в день",
    description: "Анализирует и отбирает лучших кандидатов",
  },
  {
    icon: TrendingDown,
    value: "в 5 раз",
    label: "Дешевле рекрутера",
    description: "Экономия на подборе без потери качества",
  },
  {
    icon: Phone,
    value: "100+",
    label: "Звонков в час",
    description: "Проводит первичный отбор и собеседования",
  },
];

const features = [
  "Автоматический поиск кандидатов",
  "Исходящие звонки соискателям",
  "Проведение собеседований по телефону",
  "Оценка soft skills и hard skills",
  "Интеграция с вашей ATS",
  "Детальные отчёты и аналитика",
];

export function HeroBlock() {
  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div className="text-center space-y-6">
        <Badge variant="secondary" className="px-4 py-1.5">
          Первый в России
        </Badge>
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
          AI-рекрутер, который{" "}
          <span className="text-primary">сам находит</span>
          <br className="hidden sm:block" />
          идеальных кандидатов
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Mira ищет, звонит и проводит собеседования 24/7. 
          Автоматизируйте рутину найма и сфокусируйтесь на развитии бизнеса.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Button size="lg" className="text-base px-8" data-testid="button-hero-cta">
            Попробовать бесплатно
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button size="lg" variant="outline" className="text-base px-8" data-testid="button-hero-demo">
            Запросить демо
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {metrics.map((metric) => (
          <Card
            key={metric.label}
            className="p-6 text-center hover-elevate"
            data-testid={`card-metric-${metric.label.replace(/\s+/g, "-").toLowerCase()}`}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <metric.icon className="w-6 h-6 text-primary" />
            </div>
            <div className="text-3xl lg:text-4xl font-black text-foreground mb-1">
              {metric.value}
            </div>
            <div className="text-sm font-medium text-foreground mb-2">
              {metric.label}
            </div>
            <p className="text-xs text-muted-foreground">
              {metric.description}
            </p>
          </Card>
        ))}
      </div>

      <Card className="p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-12">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl lg:text-2xl font-semibold text-foreground">
                Что умеет Mira?
              </h2>
            </div>
            <p className="text-muted-foreground mb-6">
              Полный цикл подбора персонала — от поиска до приглашения на финальное собеседование с HR.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2 text-sm"
                >
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="lg:w-[300px] flex-shrink-0">
            <Card className="bg-muted/50 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground mb-1">500+</div>
              <div className="text-sm text-muted-foreground mb-4">
                компаний уже используют Mira
              </div>
              <Badge variant="outline" className="text-xs">
                Средняя оценка 4.9/5
              </Badge>
            </Card>
          </div>
        </div>
      </Card>

      <div className="text-center text-sm text-muted-foreground">
        <p>
          Начните диалог слева, чтобы узнать больше о возможностях AIR Mira
        </p>
      </div>
    </div>
  );
}
