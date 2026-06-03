import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  Calendar,
  CheckCircle,
  Droplet,
  Info,
  RefreshCw,
} from 'lucide-react-native';

type DayItem = {
  id: string;
  label: string;
  dayNumber: string;
  isToday?: boolean;
};

type MacroItem = {
  id: string;
  label: string;
  consumed: number;
  target: number;
  unit: string;
  colorClassName: string;
};

type FoodItem = {
  id: string;
  quantity: string;
  name: string;
};

type MealItem = {
  id: string;
  time: string;
  title: string;
  kcal: number;
  foods: FoodItem[];
};

const weekDaysMock: DayItem[] = [
  { id: 'mon', label: 'Seg', dayNumber: '12' },
  { id: 'tue', label: 'Ter', dayNumber: '13' },
  { id: 'wed', label: 'Qua', dayNumber: '14', isToday: true },
  { id: 'thu', label: 'Qui', dayNumber: '15' },
  { id: 'fri', label: 'Sex', dayNumber: '16' },
  { id: 'sat', label: 'Sáb', dayNumber: '17' },
  { id: 'sun', label: 'Dom', dayNumber: '18' },
];

const dailyOverviewMock = {
  consumedCalories: 1480,
  targetCalories: 2100,
  macros: [
    {
      id: 'carbs',
      label: 'Carboidratos',
      consumed: 158,
      target: 220,
      unit: 'g',
      colorClassName: 'bg-[#4fdfa3]',
    },
    {
      id: 'proteins',
      label: 'Proteínas',
      consumed: 92,
      target: 120,
      unit: 'g',
      colorClassName: 'bg-[#8bc4ff]',
    },
    {
      id: 'fats',
      label: 'Gorduras',
      consumed: 46,
      target: 70,
      unit: 'g',
      colorClassName: 'bg-[#f4c86c]',
    },
  ] satisfies MacroItem[],
};

const mealsMock: MealItem[] = [
  {
    id: 'breakfast',
    time: '07:30',
    title: 'Café da Manhã',
    kcal: 380,
    foods: [
      { id: 'f1', quantity: '2 fatias', name: 'Pão integral' },
      { id: 'f2', quantity: '1 porção', name: 'Ovos mexidos' },
      { id: 'f3', quantity: '200ml', name: 'Café com leite sem açúcar' },
    ],
  },
  {
    id: 'lunch',
    time: '12:30',
    title: 'Almoço',
    kcal: 540,
    foods: [
      { id: 'f4', quantity: '4 colheres', name: 'Arroz integral' },
      { id: 'f5', quantity: '1 concha', name: 'Feijão carioca' },
      { id: 'f6', quantity: '120g', name: 'Frango grelhado' },
      { id: 'f7', quantity: '1 prato', name: 'Salada verde com azeite' },
    ],
  },
  {
    id: 'snack',
    time: '16:00',
    title: 'Lanche da Tarde',
    kcal: 220,
    foods: [
      { id: 'f8', quantity: '1 pote', name: 'Iogurte natural proteico' },
      { id: 'f9', quantity: '1 colher', name: 'Chia' },
      { id: 'f10', quantity: '1 unidade', name: 'Banana prata' },
    ],
  },
  {
    id: 'dinner',
    time: '19:30',
    title: 'Jantar',
    kcal: 340,
    foods: [
      { id: 'f11', quantity: '1 prato fundo', name: 'Sopa de legumes com frango' },
      { id: 'f12', quantity: '1 fatia', name: 'Torrada integral' },
    ],
  },
];

function HeaderSection({
  activeDayId,
  onSelectDay,
}: {
  activeDayId: string;
  onSelectDay: (dayId: string) => void;
}) {
  return (
    <View className="mb-6 px-4 pt-4">
      <View className="mb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-sm font-medium text-[#686d71]">Seu plano de hoje</Text>
          <Text className="mt-1 text-3xl font-bold text-[#2f3438]">Bom dia, João!</Text>
        </View>

        <View className="h-11 w-11 items-center justify-center rounded-full bg-[#e8fff5]">
          <Calendar size={20} color="#4fdfa3" />
        </View>
      </View>

      <ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        <View className="flex-row gap-3">
          {weekDaysMock.map((day) => {
            const isActive = activeDayId === day.id;

            return (
              <TouchableOpacity
                key={day.id}
                className={`min-w-[72px] rounded-2xl px-4 py-3 ${
                  isActive ? 'bg-[#4fdfa3]' : 'bg-[#f4f4f4]'
                }`}
                onPress={() => onSelectDay(day.id)}
                activeOpacity={0.9}
              >
                <Text
                  className={`text-center text-xs font-semibold ${
                    isActive ? 'text-white' : 'text-[#686d71]'
                  }`}
                >
                  {day.label}
                </Text>
                <Text
                  className={`mt-1 text-center text-lg font-bold ${
                    isActive ? 'text-white' : 'text-[#2f3438]'
                  }`}
                >
                  {day.dayNumber}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function ProgressRow({ item }: { item: MacroItem }) {
  const progress = Math.min(item.consumed / item.target, 1);

  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-[#2f3438]">{item.label}</Text>
        <Text className="text-sm text-[#686d71]">
          {item.consumed}/{item.target}
          {item.unit}
        </Text>
      </View>

      <View className="h-2 overflow-hidden rounded-full bg-[#d9e0e7]">
        <View
          className={`h-2 rounded-full ${item.colorClassName}`}
          style={{ width: `${progress * 100}%` }}
        />
      </View>
    </View>
  );
}

function DailyOverview() {
  const caloriesProgress = Math.min(
    dailyOverviewMock.consumedCalories / dailyOverviewMock.targetCalories,
    1
  );

  return (
    <View className="mx-4 mb-4 rounded-[24px] bg-white p-5">
      <Text className="text-sm font-medium text-[#686d71]">Resumo do dia</Text>
      <View className="mt-3 flex-row items-end justify-between">
        <View>
          <Text className="text-3xl font-bold text-[#2f3438]">
            {dailyOverviewMock.consumedCalories} kcal
          </Text>
          <Text className="mt-1 text-sm text-[#686d71]">
            Meta: {dailyOverviewMock.targetCalories} kcal
          </Text>
        </View>

        <Text className="text-sm font-semibold text-[#4fdfa3]">
          {Math.round(caloriesProgress * 100)}% concluído
        </Text>
      </View>

      <View className="mt-4 h-2 overflow-hidden rounded-full bg-[#d9e0e7]">
        <View
          className="h-2 rounded-full bg-[#4fdfa3]"
          style={{ width: `${caloriesProgress * 100}%` }}
        />
      </View>

      <View className="mt-5">
        {dailyOverviewMock.macros.map((macro) => (
          <ProgressRow key={macro.id} item={macro} />
        ))}
      </View>
    </View>
  );
}

function AIInsightCard() {
  return (
    <View className="mx-4 mb-5 rounded-[24px] bg-[#eef8ff] p-5">
      <View className="flex-row items-start gap-3">
        <View className="mt-0.5 h-10 w-10 items-center justify-center rounded-full bg-[#ffffff]">
          <Info size={18} color="#8bc4ff" />
        </View>

        <View className="flex-1">
          <Text className="text-sm font-semibold text-[#2f3438]">Insight da IA</Text>
          <Text className="mt-2 text-sm leading-6 text-[#686d71]">
            Sua curva glicêmica está ótima! O almoço sugerido manterá seus níveis mais
            estáveis ao longo da tarde.
          </Text>
        </View>
      </View>
    </View>
  );
}

function MealCard({ meal }: { meal: MealItem }) {
  return (
    <View className="mb-4 rounded-[24px] bg-[#f4f4f4] p-5">
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="text-sm font-medium text-[#686d71]">{meal.time}</Text>
          <Text className="mt-1 text-xl font-bold text-[#2f3438]">{meal.title}</Text>
        </View>

        <View className="rounded-full bg-white px-3 py-2">
          <Text className="text-sm font-semibold text-[#2f3438]">{meal.kcal} kcal</Text>
        </View>
      </View>

      <View className="mt-4 gap-3">
        {meal.foods.map((food) => (
          <View key={food.id} className="flex-row items-start">
            <Text className="mr-2 text-sm font-semibold text-[#4fdfa3]">•</Text>
            <Text className="flex-1 text-sm leading-6 text-[#2f3438]">
              <Text className="font-semibold text-[#686d71]">{food.quantity}</Text>
              <Text> - {food.name}</Text>
            </Text>
          </View>
        ))}
      </View>

      <View className="mt-5 flex-row gap-3">
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center rounded-2xl bg-[#4fdfa3] px-4 py-3"
          activeOpacity={0.9}
        >
          <CheckCircle size={18} color="#ffffff" />
          <Text className="ml-2 text-sm font-semibold text-white">Registrar Consumo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center rounded-2xl border border-[#d9e0e7] bg-white px-4 py-3"
          activeOpacity={0.9}
        >
          <RefreshCw size={18} color="#686d71" />
          <Text className="ml-2 text-sm font-semibold text-[#686d71]">Substituir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MealsList() {
  return (
    <View className="mb-2 px-4">
      <Text className="mb-4 text-xl font-bold text-[#2f3438]">Refeições do dia</Text>

      {mealsMock.map((meal) => (
        <MealCard key={meal.id} meal={meal} />
      ))}
    </View>
  );
}

function WaterTracker() {
  const [waterConsumed, setWaterConsumed] = useState(1000);
  const waterTarget = 2500;
  const waterProgress = Math.min(waterConsumed / waterTarget, 1);

  const quickOptions = [250, 500];

  return (
    <View className="mx-4 mb-8 rounded-[24px] bg-white p-5">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-bold text-[#2f3438]">Hidratação</Text>
          <Text className="mt-1 text-sm text-[#686d71]">
            {waterConsumed}/{waterTarget}ml
          </Text>
        </View>

        <View className="h-11 w-11 items-center justify-center rounded-full bg-[#e8fff5]">
          <Droplet size={20} color="#4fdfa3" />
        </View>
      </View>

      <View className="mt-4 h-2 overflow-hidden rounded-full bg-[#d9e0e7]">
        <View
          className="h-2 rounded-full bg-[#4fdfa3]"
          style={{ width: `${waterProgress * 100}%` }}
        />
      </View>

      <View className="mt-5 flex-row gap-3">
        {quickOptions.map((amount) => (
          <TouchableOpacity
            key={amount}
            className="flex-1 flex-row items-center justify-center rounded-2xl bg-[#f4f4f4] px-4 py-3"
            activeOpacity={0.9}
            onPress={() =>
              setWaterConsumed((current) => Math.min(current + amount, waterTarget))
            }
          >
            <Droplet size={16} color="#4fdfa3" />
            <Text className="ml-2 text-sm font-semibold text-[#2f3438]">+{amount}ml</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function MealPlanScreen() {
  const activeDefaultDay = useMemo(
    () => weekDaysMock.find((day) => day.isToday)?.id || weekDaysMock[0].id,
    []
  );
  const [activeDayId, setActiveDayId] = useState(activeDefaultDay);

  return (
    <ScrollView className="flex-1 bg-[#ffffff]" showsVerticalScrollIndicator={false}>
      <HeaderSection activeDayId={activeDayId} onSelectDay={setActiveDayId} />
      <DailyOverview />
      <AIInsightCard />
      <MealsList />
      <WaterTracker />
    </ScrollView>
  );
}
