import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

// Importing all requested components
import Header from './header';
import Carousel from './corousel';
import ContinueWatching from './continue_watching';
import Recent from './recent';
import Action from './action';
import Top10 from './top10';
import Genres from './gerens';
import RomCom from './romcom';
import ForYou from './foryou';
import Movies from './movies';
import TopSeries from './topseries';
import Card from './card';
import Popular from './popular';
import List from './list';
import Upcoming from './upcoming';
import EditorsChoice from './edtorschoice';
import Sub from './sub';
import Dub from './dub';
import BottomNav from './bottomnav';

export default function Home() {
  return (
    <View style={styles.container}>
      {/* ScrollView allows the user to scroll through all the stacked components */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <Header />
        <Carousel />
        <ContinueWatching />
        <Recent />
        <Action />
        <Top10 />
        <Genres />
        <RomCom />
        <ForYou />
        <Movies />
        <TopSeries />
        <Card />
        <Popular />
        <List />
        <Upcoming />
        <EditorsChoice />
        <Sub />
        <Dub />
      </ScrollView>

      {/* Bottom Nav stays fixed at the bottom outside the ScrollView */}
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure black space
  },
});
